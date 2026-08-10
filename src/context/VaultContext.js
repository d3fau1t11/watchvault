import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

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
  const [vaultIds, setVaultIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setVaultItems([]);
      setVaultIds(new Set());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "vault"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
        console.error("Vault subscription error:", err);
        setError("Failed to sync vault data");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Helper functions that work with the current vault state
  const isInVault = useCallback((tmdbId) => {
    return vaultIds.has(tmdbId);
  }, [vaultIds]);

  const getVaultItem = useCallback((tmdbId) => {
    return vaultItems.find(item => item.tmdbId === tmdbId);
  }, [vaultItems]);

  const getWatchingItems = useCallback(() => {
    return vaultItems.filter(item => item.status === 'Watching');
  }, [vaultItems]);

  const getCompletedItems = useCallback(() => {
    return vaultItems.filter(item => item.status === 'Completed');
  }, [vaultItems]);

  const getPlanToWatchItems = useCallback(() => {
    return vaultItems.filter(item => item.status === 'Plan to Watch');
  }, [vaultItems]);

  const value = {
    vaultItems,
    vaultIds,
    loading,
    error,
    isInVault,
    getVaultItem,
    getWatchingItems,
    getCompletedItems,
    getPlanToWatchItems,
    // Computed values
    totalItems: vaultItems.length,
    watchingCount: vaultItems.filter(item => item.status === 'Watching').length,
    completedCount: vaultItems.filter(item => item.status === 'Completed').length,
    planToWatchCount: vaultItems.filter(item => item.status === 'Plan to Watch').length,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};
