import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { updateVaultItemStatus, updateVaultItemType, removeVaultItem, addToVault, clearVault } from "../services/firestoreService";
import { searchMedia, getTVDetailsWithAiring } from "../services/tmdbApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import VaultItem from "../components/VaultItem";
import EmptyState from "../components/EmptyState";
import { Upload, Download, Search, Trash2, Calendar, Film, Play } from "lucide-react";

const MediaModal = lazy(() => import("../components/MediaModal"));

function Vault() {
    const { currentUser } = useAuth();
    const { vaultItems, loading: vaultLoading } = useVault();
    const navigate = useNavigate();
    const [selectedMedia, setSelectedMedia] = useState(null);
    const fileInputRef = useRef(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [airingThisWeek, setAiringThisWeek] = useState([]);

    // Year filter state
    const [yearFilter, setYearFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

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

    // Available years derived from vault items for the year filter
    const availableYears = useMemo(() => {
        const years = new Set();
        vaultItems.forEach(item => {
            if (item.year) years.add(item.year);
        });
        return Array.from(years).sort((a, b) => b - a);
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
            <div className="confirm-toast">
                <h3 className="confirm-toast__title">
                    <Trash2 size={20} /> Remove Item?
                </h3>
                <p className="confirm-toast__text">
                    Are you sure you want to remove this item from your vault?
                </p>
                <div className="confirm-toast__actions">
                    <button className="btn btn--outline btn--sm" onClick={() => toast.dismiss(t.id)}>Cancel</button>
                    <button className="btn btn--danger-solid btn--sm" onClick={() => executeRemoveItem(t.id, id)}>Remove</button>
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
            <div className="confirm-toast">
                <h3 className="confirm-toast__title">
                    <Trash2 size={20} /> Clear Entire Vault?
                </h3>
                <p className="confirm-toast__text">
                    Are you absolutely sure you want to delete your ENTIRE vault? This action cannot be undone and you will lose all your saved items.
                </p>
                <div className="confirm-toast__actions">
                    <button
                        className="btn btn--outline btn--sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn--danger-solid btn--sm"
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
            } catch (error) {
                toast.error("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
        event.target.value = null;
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
                year: item.year,
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

        // Type Filter
        if (typeFilter !== "all") {
            result = result.filter(item => item.type === typeFilter);
        }

        // Year Filter
        if (yearFilter !== "all") {
            const year = parseInt(yearFilter, 10);
            result = result.filter(item => item.year === year);
        }

        // Sort by date descending (newest first)
        result.sort((a, b) => {
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

        return result;
    }, [vaultItems, searchQuery, typeFilter, yearFilter]);

    if (vaultLoading) {
        return (
            <div className="page container">
                <div className="loading-state">
                    <div className="spinner" />
                    <span className="loading-state__label">Loading your vault…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page container">
            <div className="page-header">
                <div className="page-heading">
                    <h1 className="page-title">The Vault</h1>
                    <p className="page-subtitle">
                        {vaultItems.length === 1
                            ? "1 title saved"
                            : `${vaultItems.length} titles saved`}
                    </p>
                </div>

                <div className="page-header-actions">
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />
                    <button className="btn btn--outline btn--sm" onClick={() => fileInputRef.current.click()}>
                        <Upload size={16} /> Import
                    </button>
                    <button className="btn btn--outline btn--sm" onClick={handleExport}>
                        <Download size={16} /> Export
                    </button>
                    <button
                        className="btn btn--danger btn--sm"
                        onClick={handleClearVault}
                        disabled={vaultItems.length === 0}
                    >
                        <Trash2 size={16} /> Clear Vault
                    </button>
                </div>
            </div>

            {!isOnline && (
                <div className="banner banner--info banner--center">
                    Offline Mode: Browsing local vault cache. Changes will sync automatically once connected.
                </div>
            )}

            {/* Vault Search Bar */}
            <div className="search-inline">
                <input
                    type="text"
                    className="input"
                    placeholder="Search in your vault..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} className="search-inline__icon" />
            </div>

            {/* Type & Year Filter Bar */}
            <div className="filter-bar">
                <div className="filter-group">
                    <span className="filter-label">Type</span>
                    <div className="chip-group">
                        {[
                            { value: 'all', label: 'All', icon: Film },
                            { value: 'movie', label: 'Movies', icon: Film },
                            { value: 'tv', label: 'TV', icon: Play },
                            { value: 'anime', label: 'Anime', icon: Play },
                        ].map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                className={`chip${typeFilter === value ? ' chip--active' : ''}`}
                                onClick={() => setTypeFilter(value)}
                            >
                                <Icon size={14} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {availableYears.length > 0 && (
                    <div className="filter-group">
                        <span className="filter-label">Year</span>
                        <select
                            className="select"
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            aria-label="Filter by year"
                        >
                            <option value="all">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={String(year)}>{year}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Airing This Week Section */}
            {airingThisWeek.length > 0 && (
                <div className="section">
                    <div className="section-header">
                        <h2 className="section-title">
                            <Calendar size={20} /> Airing This Week
                        </h2>
                    </div>
                    <div className="airing-grid">
                        {airingThisWeek.map((item) => {
                            const airingPoster = item.poster
                                ? (item.poster.startsWith("http://") || item.poster.startsWith("https://") ? item.poster : `https://image.tmdb.org/t/p/w200${item.poster}`)
                                : null;

                            return (
                                <div
                                    key={item.id}
                                    className="airing-card"
                                    onClick={() => setSelectedMedia(item)}
                                >
                                    <div className="airing-card__head">
                                        {airingPoster ? (
                                            <img
                                                src={airingPoster}
                                                alt={item.title}
                                                className="airing-card__poster"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="airing-card__poster poster-ph">No Poster</div>
                                        )}
                                        <div className="airing-card__info">
                                            <h4 className="airing-card__title">{item.title}</h4>
                                            <div className="airing-card__type">
                                                {item.type === 'anime' ? 'Anime' : 'TV Series'}
                                            </div>
                                            <div className="airing-card__ep">
                                                S{item.nextEpisode.season_number} E{item.nextEpisode.episode_number}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="airing-card__date">
                                        <Calendar size={14} />
                                        {new Date(item.nextEpisode.air_date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>
                                </div>
                            );
                        })}
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
                <div className="vault-list">
                    {filteredAndSortedItems.length > 0 ? (
                        filteredAndSortedItems.map((item) => (
                            <VaultItem
                                key={item.id}
                                item={item}
                                onUpdateStatus={handleUpdateStatus}
                                onUpdateType={handleUpdateType}
                                onRemove={handleRemove}
                                onClick={() => setSelectedMedia(item)}
                            />
                        ))
                    ) : (
                        <div className="state-note">
                            {searchQuery ? `No items found matching "${searchQuery}".` : "No items match your current filters."}
                        </div>
                    )}
                </div>
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
