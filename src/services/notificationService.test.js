import { subscribeNotifications, checkUserNotifications, markNotificationsRead, deleteUserNotifications } from './notificationService';
import { getSeriesDetails } from './seriesService';
import { getMediaDetails, getCollection } from './tmdbApi';
import { onSnapshot } from 'firebase/firestore';

let mockRecords = new Map();
let mockCommits = [];
let mockAutoId = 0;
jest.mock('./firebase', () => ({ db: {} }));
jest.mock('./seriesService', () => ({ getSeriesDetails: jest.fn(), isAniListSeries: () => false }));
jest.mock('./tmdbApi', () => ({ getMediaDetails: jest.fn(), getCollection: jest.fn() }));
jest.mock('firebase/firestore', () => {
    const reference = path => ({ path, id: path.split('/').pop() });
    const snapshot = path => ({ id: path.split('/').pop(), ref: reference(path), exists: () => mockRecords.has(path), data: () => mockRecords.get(path) });
    return {
        collection: (db, ...parts) => reference(parts.join('/')),
        doc: (root, ...parts) => reference(root.path ? `${root.path}/${parts[0] || `auto-${++mockAutoId}`}` : parts.join('/')),
        serverTimestamp: () => 'server-timestamp',
        onSnapshot: jest.fn(() => jest.fn()),
        getDocs: async root => ({ docs: [...mockRecords.keys()].filter(path => path.startsWith(`${root.path}/`)).map(snapshot) }),
        runTransaction: async (db, callback) => {
            const writes = [];
            await callback({ get: async ref => snapshot(ref.path), set: (ref, data) => writes.push([ref.path, data]) });
            writes.forEach(([path, data]) => mockRecords.set(path, data));
        },
        writeBatch: () => {
            const operations = [];
            return {
                update: (ref, data) => operations.push({ kind: 'update', path: ref.path, data }),
                set: (ref, data) => operations.push({ kind: 'set', path: ref.path, data }),
                delete: ref => operations.push({ kind: 'delete', path: ref.path }),
                commit: async () => {
                    if (operations.some(operation => operation.kind === 'update' && !mockRecords.has(operation.path))) throw new Error('Missing notification');
                    mockCommits.push(operations);
                    operations.forEach(operation => {
                        if (operation.kind === 'delete') mockRecords.delete(operation.path);
                        else mockRecords.set(operation.path, operation.kind === 'update' ? { ...mockRecords.get(operation.path), ...operation.data } : operation.data);
                    });
                }
            };
        }
    };
});
const show = { tmdbId: 100, type: 'tv', title: 'A series', poster: '/poster.jpg' };
beforeEach(() => { mockRecords = new Map(); mockCommits = []; mockAutoId = 0; jest.clearAllMocks(); });

test('notification subscriptions bind to one user-specific collection', () => {
    const listener = jest.fn();
    const error = jest.fn();
    subscribeNotifications('viewer-a', listener, error);
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/viewer-a/notifications' }), expect.any(Function), error);
});
test('mark read atomically records the action and read timestamp in the owning bucket', async () => {
    mockRecords.set('users/viewer-a/notifications/update', { userId: 'viewer-a', read: false });
    await markNotificationsRead('viewer-a', ['update']);
    expect(mockRecords.get('users/viewer-a/notifications/update')).toMatchObject({ read: true, readAt: 'server-timestamp' });
    const events = [...mockRecords].filter(([path]) => path.startsWith('users/viewer-a/notificationEvents/'));
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({ userId: 'viewer-a', action: 'mark_read', notificationIds: ['update'], occurredAt: 'server-timestamp' });
    expect(events[0][0]).toBe(`users/viewer-a/notificationEvents/${mockRecords.get('users/viewer-a/notifications/update').lastReadAction}`);
    expect(mockCommits[0]).toHaveLength(2);
    await expect(markNotificationsRead('viewer-b', ['update'])).rejects.toThrow('Missing notification');
    expect([...mockRecords.keys()].some(path => path.startsWith('users/viewer-b/'))).toBe(false);
});
test('mark all read records large inboxes without exceeding the batch limit', async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `notice-${index}`);
    ids.forEach(id => mockRecords.set(`users/viewer-a/notifications/${id}`, { read: false }));
    await markNotificationsRead('viewer-a', ids, 'mark_all_read');
    expect(mockCommits.map(operations => operations.length)).toEqual([500, 500, 4]);
    const events = [...mockRecords.values()].filter(record => record.action === 'mark_all_read');
    expect(new Set(events.map(event => event.actionId)).size).toBe(1);
    expect(events.flatMap(event => event.notificationIds)).toHaveLength(1001);
});
test('new seasons get separate persistent alerts and previously read alerts stay read', async () => {
    getSeriesDetails.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }] });
    await checkUserNotifications('viewer-a', [show]);
    getSeriesDetails.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }, { season_number: 3, episode_count: 2 }] });
    await checkUserNotifications('viewer-a', [show]);
    const first = [...mockRecords].find(([path]) => path.startsWith('users/viewer-a/notifications/'));
    await markNotificationsRead('viewer-a', [first[0].split('/').pop()]);
    getSeriesDetails.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }, { season_number: 3, episode_count: 2 }, { season_number: 5, episode_count: 1 }] });
    await checkUserNotifications('viewer-a', [show]);
    await checkUserNotifications('viewer-a', [show]);
    const notices = [...mockRecords].filter(([path]) => path.startsWith('users/viewer-a/notifications/'));
    expect(notices).toHaveLength(2);
    expect(mockRecords.get(first[0]).read).toBe(true);
    expect(notices.filter(([, record]) => !record.read)).toHaveLength(1);
});
test('franchise alerts exclude future releases and duplicate collection seeds', async () => {
    getMediaDetails.mockResolvedValue({ belongs_to_collection: { id: 10 } });
    getCollection.mockResolvedValue({ name: 'The collection', parts: [{ id: 201, title: 'Released sequel', release_date: '2025-01-01' }, { id: 202, title: 'Future sequel', release_date: '2099-01-01' }] });
    const movie = { type: 'movie', tmdbId: 101, title: 'Original', createdAt: { seconds: 1 } };
    await checkUserNotifications('viewer-a', [movie, { ...movie, tmdbId: 102 }]);
    const notices = [...mockRecords].filter(([path]) => path.startsWith('users/viewer-a/notifications/'));
    expect(notices).toHaveLength(1);
    expect(notices[0][1].title).toBe('Released sequel');
});
test('account cleanup removes only that user’s notification data', async () => {
    ['notifications', 'notificationBaselines', 'notificationEvents'].forEach(bucket => {
        mockRecords.set(`users/viewer-a/${bucket}/a`, {});
        mockRecords.set(`users/viewer-b/${bucket}/b`, {});
    });
    await deleteUserNotifications('viewer-a');
    expect([...mockRecords.keys()]).toEqual(['users/viewer-b/notifications/b', 'users/viewer-b/notificationBaselines/b', 'users/viewer-b/notificationEvents/b']);
});
