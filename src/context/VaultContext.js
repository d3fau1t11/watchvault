import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { shouldAutoComplete } from "../utils/autoComplete";
import { getSeriesDetails } from "../services/seriesService";
import { bulkUpdateVaultItems } from "../services/firestoreService";
import { normalizeProgress } from "../utils/series";

const VaultContext = createContext(null);

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
};

export const VaultProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [vaultItems, setVaultItems] = useState([]);
  const [vaultOwner, setVaultOwner] = useState(null);
  const [vaultIds, setVaultIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setVaultOwner(null);
      setVaultItems([]);
      setVaultIds(new Set());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setVaultItems([]);
    setVaultIds(new Set());
    setVaultOwner(currentUser.uid);
    let active = true;

    const q = query(
      collection(db, "vault"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!active) return;
        const items = [];
        const ids = new Set();
        
        snapshot.forEach((docSnap) => {
          const item = { id: docSnap.id, ...docSnap.data() };
          // Ensure updatedAt exists for sorting
          if (!item.updatedAt) {
            item.updatedAt = item.createdAt;
          }
          items.push(item);
          ids.add(item.tmdbId);
        });

        setVaultItems(items);
        setVaultIds(ids);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!active) return;
        console.error("Vault subscription error:", err);
        setError("Failed to sync vault data");
        setLoading(false);
      }
    );

    return () => { active = false; unsubscribe(); };
  }, [currentUser]);

  // Repair saved progress against real episode lists for every saved series.
  // Respect a manual status choice until the viewer updates episode progress.
  useEffect(() => {
    if (!currentUser || vaultOwner !== currentUser.uid || vaultItems.length === 0) return;
    let cancelled = false;

    const checkExistingItems = async () => {
      const watchingShows = vaultItems.filter(
        item =>
          (item.type === "tv" || item.type === "anime")
      );

      const updates = [];

      for (const item of watchingShows) {
        try {
          const details = await getSeriesDetails(item);
          if (cancelled) return;
          const progress = normalizeProgress(item, details);
          const data = {};
          Object.entries(progress).forEach(([field, value]) => { if (item[field] !== value) data[field] = value; });
          if (item.status === 'Watching' && item.manualStatus !== true && shouldAutoComplete({ ...item, ...progress }, details)) data.status = 'Completed';
          if (Object.keys(data).length) updates.push({ id: item.id, data });
        } catch (err) {
          console.error(`Auto-complete check failed for "${item.title}":`, err);
        }
      }
      if (!cancelled && updates.length) {
        const result = await bulkUpdateVaultItems(updates);
        if (!result.success) setError('Some episode corrections could not sync. Please try again.');
      }
    };

    checkExistingItems();
    return () => { cancelled = true; };
  }, [currentUser, vaultOwner, vaultItems]);

  // Hide the previous account immediately, before a new Firestore subscription
  // has responded. Notification checks must never consume another user's list.
  const currentItems = useMemo(() => currentUser && vaultOwner === currentUser.uid ? vaultItems : [], [currentUser, vaultOwner, vaultItems]);

  // Helper functions that work with the current vault state
  const isInVault = useCallback((tmdbId) => {
    return currentItems.some(item => item.tmdbId === tmdbId);
  }, [currentItems]);

  const getVaultItem = useCallback((tmdbId) => {
    return currentItems.find(item => item.tmdbId === tmdbId);
  }, [currentItems]);

  const getWatchingItems = useCallback(() => {
    return currentItems.filter(item => item.status === 'Watching');
  }, [currentItems]);

  const getCompletedItems = useCallback(() => {
    return currentItems.filter(item => item.status === 'Completed');
  }, [currentItems]);

  const getPlanToWatchItems = useCallback(() => {
    return currentItems.filter(item => item.status === 'Plan to Watch');
  }, [currentItems]);

  const value = {
    vaultItems: currentItems,
    vaultIds: vaultOwner === currentUser?.uid ? vaultIds : new Set(),
    loading,
    error,
    isInVault,
    getVaultItem,
    getWatchingItems,
    getCompletedItems,
    getPlanToWatchItems,
    // Computed values
    totalItems: currentItems.length,
    watchingCount: currentItems.filter(item => item.status === 'Watching').length,
    completedCount: currentItems.filter(item => item.status === 'Completed').length,
    planToWatchCount: currentItems.filter(item => item.status === 'Plan to Watch').length,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};
