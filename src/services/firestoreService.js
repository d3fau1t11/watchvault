import { db } from "./firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, writeBatch } from "firebase/firestore";
import { deriveCategory } from "../utils/categories";

const COLLECTION_NAME = "vault";

/* Firestore caps a write batch at 500 operations. */
const BATCH_LIMIT = 500;

export const addToVault = async (userId, mediaItem, status = "Plan to Watch") => {
    try {
        let mediaType = mediaItem.type || mediaItem.media_type;
        if (mediaItem.type === "anime" || mediaItem.genre_ids?.includes(16)) {
            mediaType = "anime";
        }

        const TMDB_GENRES = {
            28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
            99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
            27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
            10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
            10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
            10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
        };

        let genresList = [];
        if (mediaItem.genres) {
            genresList = mediaItem.genres.map(g => g.name || g);
        } else if (mediaItem.genre_ids) {
            genresList = mediaItem.genre_ids.map(id => TMDB_GENRES[id] || "Unknown").filter(g => g !== "Unknown");
        }

        /* Derived through the shared mapping so a new item lands in one of the
           categories the dropdown actually offers. The old behaviour took
           genresList[0] verbatim, which could write names like
           "Sci-Fi & Fantasy" that the select could never round-trip. */
        const defaultCategory = mediaItem.category || deriveCategory({ type: mediaType, genres: genresList });

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            tmdbId: mediaItem.id,
            title: mediaItem.title || mediaItem.name,
            poster: mediaItem.poster_path,
            type: mediaType,
            status,
            genres: genresList,
            category: defaultCategory,
            createdAt: serverTimestamp(),
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding to vault:", error);
        return { success: false, error: error.message };
    }
};

export const getVaultItems = async (userId) => {
    try {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        return items;
    } catch (error) {
        console.error("Error getting vault items:", error);
        return [];
    }
};

export const updateVaultItemStatus = async (itemId, newStatus) => {
    try {
        const itemRef = doc(db, COLLECTION_NAME, itemId);
        await updateDoc(itemRef, {
            status: newStatus
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating vault item status:", error);
        return { success: false, error: error.message };
    }
};

export const updateVaultItemType = async (itemId, newType) => {
    try {
        const itemRef = doc(db, COLLECTION_NAME, itemId);
        await updateDoc(itemRef, {
            type: newType
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating vault item type:", error);
        return { success: false, error: error.message };
    }
};

export const updateVaultItemProgress = async (itemId, season, episode) => {
    try {
        const itemRef = doc(db, COLLECTION_NAME, itemId);
        await updateDoc(itemRef, {
            season,
            episode,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating vault item progress:", error);
        return { success: false, error: error.message };
    }
};

export const updateVaultItemDetails = async (itemId, detailsData) => {
    try {
        const itemRef = doc(db, COLLECTION_NAME, itemId);
        await updateDoc(itemRef, {
            ...detailsData,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating vault item details:", error);
        return { success: false, error: error.message };
    }
};

/* Applies many small field updates in as few round trips as Firestore allows.
   `updates` is [{ id, data }, ...]; anything past 500 ops rolls into the next
   batch. Returns the number of documents actually written. */
export const bulkUpdateVaultItems = async (updates) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        return { success: true, updated: 0 };
    }

    try {
        let updated = 0;

        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
            const chunk = updates.slice(i, i + BATCH_LIMIT);
            const batch = writeBatch(db);

            chunk.forEach(({ id, data }) => {
                batch.update(doc(db, COLLECTION_NAME, id), {
                    ...data,
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();
            updated += chunk.length;
        }

        return { success: true, updated };
    } catch (error) {
        console.error("Error bulk updating vault items:", error);
        return { success: false, error: error.message };
    }
};

export const removeVaultItem = async (itemId) => {
    try {
        const itemRef = doc(db, COLLECTION_NAME, itemId);
        await deleteDoc(itemRef);
        return { success: true };
    } catch (error) {
        console.error("Error removing vault item:", error);
        return { success: false, error: error.message };
    }
};

export const clearVault = async (userId) => {
    try {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        querySnapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error clearing vault:", error);
        return { success: false, error: error.message };
    }
};

