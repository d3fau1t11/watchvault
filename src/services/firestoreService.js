import { db } from "./firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, writeBatch } from "firebase/firestore";

const COLLECTION_NAME = "vault";

export const addToVault = async (userId, mediaItem, status = "Plan to Watch") => {
    try {
        // Auto-detect Anime (Any media with the Animation genre)
        let mediaType = mediaItem.media_type;
        if (mediaItem.genre_ids?.includes(16)) {
            mediaType = "anime";
        }

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            tmdbId: mediaItem.id,
            title: mediaItem.title || mediaItem.name,
            poster: mediaItem.poster_path,
            type: mediaType,
            status,
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
