import { collection, doc, onSnapshot, runTransaction, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { getSeriesDetails, isAniListSeries } from './seriesService';
import { getMediaDetails, getCollection } from './tmdbApi';

const userCollection = (uid, bucket) => collection(db, 'users', uid, bucket);
const userDocument = (uid, bucket, id) => doc(db, 'users', uid, bucket, id);

export function subscribeNotifications(uid, onChange, onError) {
    if (!uid) { onChange([]); return () => {}; }
    return onSnapshot(userCollection(uid, 'notifications'), snapshot => {
        const notifications = snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id }));
        onChange(notifications.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, onError);
}

async function recordSeasonChanges(uid, item, details, enabled) {
    const key = `${isAniListSeries(item) ? 'anilist' : 'tmdb'}-${item.type}-${item.tmdbId}`;
    const numbers = details.seasons.map(season => season.season_number);
    const baseline = userDocument(uid, 'notificationBaselines', key);
    if (!enabled()) return;
    await runTransaction(db, async transaction => {
        const saved = await transaction.get(baseline);
        if (!enabled()) return;
        const previous = saved.exists() ? saved.data().seasonNumbers || [] : null;
        const added = previous ? numbers.filter(number => !previous.includes(number)) : [];
        if (added.length) {
            const id = `new-season-${key}-${added.join('-')}`;
            // Include the season numbers in the ID: reading a season alert must
            // never suppress later alerts for other seasons of the same show.
            const notification = userDocument(uid, 'notifications', id);
            const existing = await transaction.get(notification);
            if (!existing.exists()) transaction.set(notification, { userId: uid, type: 'new-season', title: item.title, tmdbId: item.tmdbId, poster: item.poster || null, newSeasons: added.length, totalSeasons: numbers.length, seasonNumbers: added, read: false, readAt: null, createdAt: serverTimestamp() });
        }
        if (!previous || JSON.stringify(previous) !== JSON.stringify(numbers)) transaction.set(baseline, { userId: uid, seasonNumbers: numbers, updatedAt: serverTimestamp() });
    });
}

async function recordFranchiseReleases(uid, item, owned, enabled) {
    const details = await getMediaDetails(item.tmdbId, 'movie');
    if (!details?.belongs_to_collection || !enabled()) return;
    const franchise = await getCollection(details.belongs_to_collection.id);
    const addedAt = item.createdAt?.toDate?.() || (item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date());
    const now = Date.now();
    for (const part of franchise?.parts || []) {
        const release = part.release_date ? new Date(part.release_date).getTime() : NaN;
        if (owned.has(part.id) || !(release > addedAt.getTime() && release <= now) || !enabled()) continue;
        const ref = userDocument(uid, 'notifications', `franchise-${details.belongs_to_collection.id}-${part.id}`);
        await runTransaction(db, async transaction => {
            const existing = await transaction.get(ref);
            if (!existing.exists() && enabled()) transaction.set(ref, { userId: uid, type: 'franchise', title: part.title || item.title, tmdbId: part.id, poster: part.poster_path || item.poster || null, movieTitle: franchise.name || item.title, read: false, readAt: null, createdAt: serverTimestamp() });
        });
    }
}

export async function checkUserNotifications(uid, items, enabled = () => true) {
    if (!uid || !enabled()) return;
    const owned = new Set(items.filter(item => item.type === 'movie').map(item => item.tmdbId));
    const failures = [];
    for (let index = 0; index < items.length; index += 4) {
        if (!enabled()) return;
        const results = await Promise.allSettled(items.slice(index, index + 4).map(async item => {
            if (item.type === 'tv' || item.type === 'anime') await recordSeasonChanges(uid, item, await getSeriesDetails(item), enabled);
            else if (item.type === 'movie') await recordFranchiseReleases(uid, item, owned, enabled);
        }));
        failures.push(...results.filter(result => result.status === 'rejected'));
    }
    if (failures.length) throw new Error('Some release updates could not be checked');
}

export async function markNotificationsRead(uid, ids, action = 'mark_read') {
    if (!uid) throw new Error('Sign in to update notifications');
    if (!['mark_read', 'mark_all_read'].includes(action)) throw new Error('Invalid notification action');
    const unique = [...new Set(ids)].filter(id => typeof id === 'string' && id && !id.includes('/'));
    if (!unique.length) return;
    const actionId = doc(userCollection(uid, 'notificationEvents')).id;
    // Reserve one operation per batch for the action record. Both the read
    // states and the record commit together, including for large inboxes.
    for (let index = 0; index < unique.length; index += 499) {
        const chunk = unique.slice(index, index + 499);
        const eventId = index === 0 ? actionId : `${actionId}-${index}`;
        const batch = writeBatch(db);
        chunk.forEach(id => batch.update(userDocument(uid, 'notifications', id), { read: true, readAt: serverTimestamp(), lastReadAction: eventId }));
        batch.set(userDocument(uid, 'notificationEvents', eventId), { userId: uid, action, actionId, notificationIds: chunk, occurredAt: serverTimestamp() });
        await batch.commit();
    }
}

export async function deleteUserNotifications(uid) {
    for (const bucket of ['notifications', 'notificationBaselines', 'notificationEvents']) {
        const snapshot = await getDocs(userCollection(uid, bucket));
        for (let index = 0; index < snapshot.docs.length; index += 500) {
            const batch = writeBatch(db);
            snapshot.docs.slice(index, index + 500).forEach(entry => batch.delete(entry.ref));
            await batch.commit();
        }
    }
}
