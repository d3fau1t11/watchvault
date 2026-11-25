import { updateVaultItemStatus, updateVaultItemProgress } from './firestoreService';
import { updateDoc } from 'firebase/firestore';

let mockRecord;
jest.mock('./firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: (db, collection, id) => ({ path: `${collection}/${id}` }),
    serverTimestamp: () => 'server-timestamp',
    updateDoc: jest.fn()
}));

beforeEach(() => {
    mockRecord = { status: 'Completed', season: 1, episode: 2, rating: 9, notes: 'Keep this note' };
    updateDoc.mockImplementation(async (ref, data) => { mockRecord = { ...mockRecord, ...data }; });
});

test('manual status persists without losing progress or curation and progress restores automatic status', async () => {
    await expect(updateVaultItemStatus('saved-show', 'Watching', { manual: true })).resolves.toEqual({ success: true });
    expect(updateDoc).toHaveBeenLastCalledWith({ path: 'vault/saved-show' }, expect.objectContaining({ status: 'Watching', manualStatus: true, updatedAt: 'server-timestamp' }));
    expect(mockRecord).toMatchObject({ status: 'Watching', manualStatus: true, season: 1, episode: 2, rating: 9, notes: 'Keep this note' });
    await expect(updateVaultItemProgress('saved-show', 1, 1)).resolves.toEqual({ success: true });
    expect(mockRecord).toMatchObject({ status: 'Watching', manualStatus: false, season: 1, episode: 1, rating: 9, notes: 'Keep this note' });
    await updateVaultItemStatus('saved-show', 'Completed');
    expect(mockRecord).toMatchObject({ status: 'Completed', manualStatus: false });
});
