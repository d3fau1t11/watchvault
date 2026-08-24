import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { updateVaultItemStatus, updateVaultItemType, removeVaultItem, addToVault, clearVault, updateVaultItemProgress } from "../services/firestoreService";
import { searchMedia, getTVDetailsWithAiring } from "../services/tmdbApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import VaultItem from "../components/VaultItem";
import FilterTabs from "../components/FilterTabs";
import EmptyState from "../components/EmptyState";
import { Upload, Download, Search, Trash2, Filter, Calendar, Grid, Layers } from "lucide-react";

const MediaModal = lazy(() => import("../components/MediaModal"));

function Vault() {
    const { currentUser } = useAuth();
    const { vaultItems, loading: vaultLoading } = useVault();
    const navigate = useNavigate();
    const [selectedMedia, setSelectedMedia] = useState(null);
    const fileInputRef = useRef(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [airingThisWeek, setAiringThisWeek] = useState([]);

    // Fetch airing this week data & run background auto-completion for existing items
    useEffect(() => {
        const fetchAiringThisWeek = async () => {
            if (!currentUser || vaultItems.length === 0) {
                setAiringThisWeek([]);
                return;
            }

            const tvShows = vaultItems.filter(item => 
                (item.type === 'tv' || item.type === 'anime') && item.status !== 'Completed'
            );

            if (tvShows.length === 0) {
                setAiringThisWeek([]);
                return;
            }

            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const airingShows = [];

            for (const show of tvShows) {
                try {
                    const details = await getTVDetailsWithAiring(show.tmdbId);
                    
                    // Auto-complete check for already listed shows
                    const isEndedOrCanceled = details?.status === 'Ended' || details?.status === 'Canceled';
                    const nonZeroSeasons = details?.seasons?.filter(s => s.season_number > 0) || [];
                    const lastSeasonObj = nonZeroSeasons[nonZeroSeasons.length - 1];
                    
                    if (isEndedOrCanceled && lastSeasonObj) {
                        const userSeason = show.season || 1;
                        const userEpisode = show.episode || 0;
                        const isCompleted = (userSeason > lastSeasonObj.season_number) || 
                                            (userSeason === lastSeasonObj.season_number && userEpisode >= lastSeasonObj.episode_count);
                        if (isCompleted) {
                            await updateVaultItemStatus(show.id, 'Completed');
                            toast.success(`"${show.title}" automatically marked as Completed!`);
                            continue;
                        }
                    }
                    
                    if (show.status === 'Watching' && details?.next_episode_to_air) {
                        const nextAirDate = new Date(details.next_episode_to_air.air_date);
                        if (nextAirDate >= now && nextAirDate <= nextWeek) {
                            airingShows.push({
                                ...show,
                                nextEpisode: details.next_episode_to_air
                            });
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch airing data for', show.title, err);
                }
            }

            setAiringThisWeek(airingShows);
        };

        fetchAiringThisWeek();
    }, [currentUser, vaultItems]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Dashboard & Filter/Sort States
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterTag, setFilterTag] = useState("all");
    const [filterCategory, setFilterCategory] = useState("all");
    const [sortBy, setSortBy] = useState("date_desc");
    const [viewMode, setViewMode] = useState("grid"); // grid or grouped

    const allTags = useMemo(() => {
        const tagsSet = new Set();
        vaultItems.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => tagsSet.add(tag));
            }
        });
        return Array.from(tagsSet).sort();
    }, [vaultItems]);

    const allCategories = useMemo(() => {
        const categoriesSet = new Set();
        vaultItems.forEach(item => {
            const cat = item.category || "Uncategorized";
            categoriesSet.add(cat);
        });
        return Array.from(categoriesSet).sort();
    }, [vaultItems]);


    const handleUpdateStatus = async (id, newStatus) => {
        const response = await updateVaultItemStatus(id, newStatus);
        if (response.success) {
            toast.success("Status updated!");
        } else {
            toast.error("Failed to update status.");
        }
    };

    const handleUpdateType = async (id, newType) => {
        const response = await updateVaultItemType(id, newType);
        if (response.success) {
            toast.success("Type classification updated!");
        } else {
            toast.error("Failed to update type.");
        }
    };

    const handleUpdateProgress = async (id, season, episode) => {
        const response = await updateVaultItemProgress(id, season, episode);
        if (response.success) {
            // Real-time sync will handle the update
            // Auto-complete if show is ended/canceled and all episodes are watched
            try {
                const item = vaultItems.find(i => i.id === id);
                if (item && item.type !== 'movie') {
                    const details = await getTVDetailsWithAiring(item.tmdbId);
                    const isEndedOrCanceled = details?.status === 'Ended' || details?.status === 'Canceled';
                    const nonZeroSeasons = details?.seasons?.filter(s => s.season_number > 0) || [];
                    const lastSeasonObj = nonZeroSeasons[nonZeroSeasons.length - 1];
                    
                    if (isEndedOrCanceled && lastSeasonObj) {
                        if (season === lastSeasonObj.season_number && episode >= lastSeasonObj.episode_count) {
                            await updateVaultItemStatus(id, 'Completed');
                            toast.success(`${item.title} automatically marked as Completed!`);
                        }
                    }
                }
            } catch (e) {
                console.error("Auto-complete check failed on Vault progress change:", e);
            }
        } else {
            toast.error("Failed to update progress.");
        }
    };

    const executeRemoveItem = async (toastId, id) => {
        toast.dismiss(toastId);
        const loadingToast = toast.loading("Removing item...");
        const response = await removeVaultItem(id);
        if (response.success) {
            toast.success("Item removed from vault.", { id: loadingToast });
        } else {
            toast.error("Failed to remove item.", { id: loadingToast });
        }
    };

    const handleRemove = (id) => {
        toast.custom((t) => (
            <div style={{ 
                background: 'var(--bg-glass)', 
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(248, 113, 113, 0.5)', 
                padding: '20px', 
                borderRadius: '16px', 
                color: 'var(--text-primary)',
                boxShadow: '0 10px 25px -5px rgba(248, 113, 113, 0.15)'
            }}>
                <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: '#f87171' }}>Remove Item?</h3>
                <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>Are you sure you want to remove this item from your vault?</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={() => toast.dismiss(t.id)}>Cancel</button>
                    <button className="btn" style={{ background: '#ef4444' }} onClick={() => executeRemoveItem(t.id, id)}>Remove</button>
                </div>
            </div>
        ), { duration: Infinity, id: `remove-${id}` });
    };

    const executeClearVault = async (toastId) => {
        toast.dismiss(toastId);
        const loadingToast = toast.loading("Clearing vault...");
        const response = await clearVault(currentUser.uid);
        if (response.success) {
            toast.success("Vault has been completely cleared.", { id: loadingToast });
        } else {
            toast.error("Failed to clear vault.", { id: loadingToast });
        }
    };

    const handleClearVault = () => {
        if (vaultItems.length === 0) return;
        
        toast.custom((t) => (
            <div style={{ 
                background: 'var(--bg-glass)', 
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(248, 113, 113, 0.5)', 
                padding: '24px', 
                borderRadius: '16px', 
                color: 'var(--text-primary)',
                boxShadow: '0 25px 50px -12px rgba(248, 113, 113, 0.25)',
                maxWidth: '400px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#f87171' }}>
                    <Trash2 size={24} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Clear Entire Vault?</h3>
                </div>
                <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Are you absolutely sure you want to delete your ENTIRE vault? This action cannot be undone and you will lose all your saved items.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button 
                        className="btn btn-outline" 
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                    <button 
                        className="btn" 
                        style={{ background: '#ef4444', color: 'white' }} 
                        onClick={() => executeClearVault(t.id)}
                    >
                        Yes, Delete All
                    </button>
                </div>
            </div>
        ), { duration: Infinity, id: 'clear-vault-confirm' });
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.items || !Array.isArray(json.items)) {
                    toast.error("Invalid JSON. Expected 'items' array.");
                    return;
                }

                const itemsToImport = json.items;
                const loadingToast = toast.loading(`Importing 0 / ${itemsToImport.length}...`);
                
                let successCount = 0;
                
                for (let i = 0; i < itemsToImport.length; i++) {
                    const item = itemsToImport[i];
                    if (item.title) {
                        try {
                            const searchResult = await searchMedia(item.title, 1);
                            const topResult = searchResult.results?.filter(r => r.media_type === 'movie' || r.media_type === 'tv')[0];
                            if (topResult) {
                                await addToVault(currentUser.uid, topResult, "Plan to Watch");
                                successCount++;
                            }
                        } catch (err) {
                            console.error("Failed to import", item.title, err);
                        }
                    }
                    toast.loading(`Importing ${i + 1} / ${itemsToImport.length}...`, { id: loadingToast });
                }

                toast.success(`Import complete! Added ${successCount} items.`, { id: loadingToast });
                
                // Real-time sync will handle the new items
            } catch (error) {
                toast.error("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
        event.target.value = null; // Reset input
    };

    const handleExport = () => {
        if (vaultItems.length === 0) {
            toast.error("Nothing to export!");
            return;
        }
        const exportData = {
            exportedAt: new Date().toISOString(),
            total: vaultItems.length,
            items: vaultItems.map(item => ({
                title: item.title,
                type: item.type,
                status: item.status,
                tmdbId: item.tmdbId,
                addedAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : null
            }))
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "WatchVault_Export.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Vault exported successfully!");
    };

    const filteredAndSortedItems = useMemo(() => {
        let result = [...vaultItems];

        // Search Query Filter
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            result = result.filter(item => item.title?.toLowerCase().includes(query));
        }

        // Filter Type
        if (filterType !== "all") {
            result = result.filter(item => item.type === filterType);
        }

        // Filter Status
        if (filterStatus !== "all") {
            result = result.filter(item => item.status === filterStatus);
        }

        // Filter Tag
        if (filterTag !== "all") {
            result = result.filter(item => item.tags && item.tags.includes(filterTag));
        }

        // Filter Category
        if (filterCategory !== "all") {
            result = result.filter(item => {
                const itemCat = item.category || "Uncategorized";
                return itemCat === filterCategory;
            });
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === "title_asc") {
                return a.title.localeCompare(b.title);
            } else if (sortBy === "date_asc") {
                return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
            } else {
                // date_desc
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            }
        });

        return result;
    }, [vaultItems, searchQuery, filterType, filterStatus, filterTag, filterCategory, sortBy]);

    const groupedItems = useMemo(() => {
        const groups = {};
        filteredAndSortedItems.forEach(item => {
            const cat = item.category || "Uncategorized";
            if (!groups[cat]) {
                groups[cat] = [];
            }
            groups[cat].push(item);
        });
        return groups;
    }, [filteredAndSortedItems]);

    if (vaultLoading) {
        return <div className="page container" style={{ textAlign: "center" }}>Loading your vault...</div>;
    }



    return (
        <div className="page container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="page-title" style={{ marginBottom: 0, background: 'linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    The Vault
                </h1>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload}
                    />
                    <button className="btn btn-outline" onClick={() => fileInputRef.current.click()} style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
                        <Upload size={16} /> Import
                    </button>
                    <button className="btn btn-outline" onClick={handleExport} style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
                        <Download size={16} /> Export
                    </button>
                    <button 
                        className="btn btn-outline" 
                        onClick={handleClearVault} 
                        style={{ fontSize: '0.9rem', padding: '8px 12px', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                        disabled={vaultItems.length === 0}
                    >
                        <Trash2 size={16} /> Clear Vault
                    </button>
                </div>
            </div>

            {!isOnline && (
                <div style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '24px',
                    textAlign: 'center',
                    color: '#60a5fa',
                    fontSize: '0.9rem'
                }}>
                    Offline Mode: Browsing local vault cache. Changes will sync automatically once connected.
                </div>
            )}

            {/* Vault Search Bar */}
            <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '400px' }}>
                <input 
                    type="text" 
                    placeholder="Search in your vault..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingLeft: '40px',
                        borderRadius: '8px',
                        border: 'var(--glass-border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                />
                <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {/* Modern Tab Navigation */}
            <FilterTabs 
                options={[
                    { value: 'all', label: 'All Collection' },
                    { value: 'movie', label: 'Movies' },
                    { value: 'tv', label: 'TV Series' },
                    { value: 'anime', label: 'Anime' }
                ]}
                activeOption={filterType}
                onChange={setFilterType}
            />

            {/* Airing This Week Section */}
            {airingThisWeek.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <Calendar size={20} style={{ color: 'var(--accent-primary)' }} />
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Airing This Week</h3>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '16px'
                    }}>
                        {airingThisWeek.map((item) => (
                            <div 
                                key={item.id}
                                onClick={() => setSelectedMedia(item)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid rgba(229, 9, 20, 0.2)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                    <img 
                                        src={item.poster ? (item.poster.startsWith("http://") || item.poster.startsWith("https://") ? item.poster : `https://image.tmdb.org/t/p/w200${item.poster}`) : 'https://via.placeholder.com/80x120?text=No+Poster'}
                                        alt={item.title}
                                        style={{
                                            width: '60px',
                                            height: '90px',
                                            objectFit: 'cover',
                                            borderRadius: '6px',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.3 }}>
                                            {item.title}
                                        </h4>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            {item.type === 'anime' ? 'Anime' : 'TV Series'}
                                        </div>
                                        <div style={{ 
                                            fontSize: '0.8rem', 
                                            color: '#fbbf24',
                                            fontWeight: 500 
                                        }}>
                                            S{item.nextEpisode.season_number} E{item.nextEpisode.episode_number}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    fontSize: '0.85rem', 
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Calendar size={14} />
                                    {new Date(item.nextEpisode.air_date).toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {vaultItems.length === 0 ? (
                <EmptyState 
                    icon="library"
                    title="Your vault is empty"
                    message="Start searching to add movies, TV shows, and anime to your watchlist."
                    actionText="Explore & Search Titles"
                    onAction={() => navigate("/")}
                />
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: 'var(--glass-border)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <Filter size={18} /> Filters & Sorting:
                        </div>

                        <select className="status-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="Plan to Watch">Plan to Watch</option>
                            <option value="Watching">Watching</option>
                            <option value="Completed">Completed</option>
                        </select>

                        {allTags.length > 0 && (
                            <select className="status-select" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
                                <option value="all">All Tags</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>#{tag}</option>
                                ))}
                            </select>
                        )}

                        {allCategories.length > 0 && (
                            <select className="status-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                <option value="all">All Categories</option>
                                {allCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        )}

                        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', marginLeft: 'auto' }}>
                            <button 
                                onClick={() => setViewMode("grid")}
                                title="Grid View"
                                style={{
                                    background: viewMode === "grid" ? 'var(--accent-primary)' : 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <Grid size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode("grouped")}
                                title="Group by Category"
                                style={{
                                    background: viewMode === "grouped" ? 'var(--accent-primary)' : 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <Layers size={16} />
                            </button>
                        </div>

                        <select className="status-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="date_desc">Newest First</option>
                            <option value="date_asc">Oldest First</option>
                            <option value="title_asc">Alphabetical (A-Z)</option>
                        </select>
                    </div>

                    {viewMode === "grid" ? (
                        <div className="vault-list">
                            {filteredAndSortedItems.length > 0 ? (
                                filteredAndSortedItems.map((item) => (
                                    <VaultItem 
                                        key={item.id} 
                                        item={item} 
                                        onUpdateStatus={handleUpdateStatus}
                                        onUpdateType={handleUpdateType}
                                        onUpdateProgress={handleUpdateProgress}
                                        onRemove={handleRemove}
                                        onClick={() => setSelectedMedia(item)}
                                    />
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    {searchQuery ? `No items found matching "${searchQuery}".` : "No items match your current filters."}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="vault-grouped-list">
                            {Object.keys(groupedItems).length > 0 ? (
                                Object.keys(groupedItems).sort().map((categoryName) => {
                                    const items = groupedItems[categoryName];
                                    if (items.length === 0) return null;
                                    return (
                                        <div key={categoryName} className="category-section">
                                            <div className="category-row-header">
                                                <h3 className="category-title">{categoryName}</h3>
                                                <span className="category-count">{items.length} Title{items.length > 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="category-row-scroll">
                                                {items.map((item) => (
                                                    <VaultItem 
                                                        key={item.id} 
                                                        item={item} 
                                                        onUpdateStatus={handleUpdateStatus}
                                                        onUpdateType={handleUpdateType}
                                                        onUpdateProgress={handleUpdateProgress}
                                                        onRemove={handleRemove}
                                                        onClick={() => setSelectedMedia(item)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    {searchQuery ? `No items found matching "${searchQuery}".` : "No items match your current filters."}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {selectedMedia && (
                <Suspense fallback={null}>
                    <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
                </Suspense>
            )}
        </div>
    );
}

export default Vault;
