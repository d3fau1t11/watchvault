import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { addToVault } from "../services/firestoreService";
import { getRecommendations } from "../services/tmdbApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import FilterTabs from "../components/FilterTabs";
import EmptyState from "../components/EmptyState";
import { Sparkles, Plus, Info, Star, ChevronDown } from "lucide-react";

const MediaModal = lazy(() => import("../components/MediaModal"));

function Recommendations() {
    const { currentUser } = useAuth();
    const { vaultItems, loading: vaultLoading } = useVault();
    const navigate = useNavigate();
    const [personalizedRecs, setPersonalizedRecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    // Show More & Filter options
    const [filterType, setFilterType] = useState("all");
    const [visibleCount, setVisibleCount] = useState(8);

    useEffect(() => {
        if (!currentUser) {
            navigate("/login");
            return;
        }

        const fetchWatchlistRecommendations = async () => {
            setLoading(true);
            try {
                if (vaultItems.length > 0) {
                    // Filter completed or active items as seeds
                    const activeItems = vaultItems.filter(item => item.status === 'Completed' || item.status === 'Watching');
                    const targetItems = activeItems.length > 0 ? activeItems : vaultItems;

                    // Sort by recency and take up to 4 seed items to expand initial suggestions pool
                    const seeds = [...targetItems]
                        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                        .slice(0, 4);
                    
                    let combined = [];
                    const vaultTmdbIds = new Set(vaultItems.map(i => i.tmdbId));

                    // Fetch recommendations for each seed item
                    for (const seed of seeds) {
                        if (seed.tmdbId) {
                            const type = seed.type === 'anime' ? 'tv' : seed.type;
                            const data = await getRecommendations(seed.tmdbId, type);
                            if (data && data.results) {
                                const tagged = data.results.map(r => ({ ...r, recommendedBy: seed.title }));
                                combined.push(...tagged);
                            }
                        }
                    }

                    // Deduplicate and filter out items already in the user's Vault
                    const seenIds = new Set();
                    const uniqueRecs = [];

                    for (const rec of combined) {
                        const mediaType = rec.media_type || (rec.title ? 'movie' : 'tv');
                        const normalizedRec = { ...rec, media_type: mediaType };

                        if (!seenIds.has(normalizedRec.id) && !vaultTmdbIds.has(normalizedRec.id)) {
                            seenIds.add(normalizedRec.id);
                            uniqueRecs.push(normalizedRec);
                        }
                    }

                    // Sort recommendations by ratings
                    uniqueRecs.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                    setPersonalizedRecs(uniqueRecs); // Store the entire recommendation pool
                } else {
                    setPersonalizedRecs([]);
                }
            } catch (err) {
                console.error("Failed to load recommendations", err);
                toast.error("Could not fetch recommendation insights.");
            } finally {
                setLoading(false);
            }
        };

        fetchWatchlistRecommendations();
    }, [currentUser, navigate, vaultItems]);

    // Handle filter type toggle (resets visual pagination)
    const handleFilterChange = (type) => {
        setFilterType(type);
        setVisibleCount(8); // Reset to show initial page count
    };

    // Filter matching pool dynamically
    const filteredRecommendations = useMemo(() => {
        return personalizedRecs.filter((rec) => {
            if (filterType === "all") return true;
            return rec.media_type === filterType;
        });
    }, [personalizedRecs, filterType]);

    // Sliced view for pagination
    const visibleRecommendations = useMemo(() => {
        return filteredRecommendations.slice(0, visibleCount);
    }, [filteredRecommendations, visibleCount]);

    // Quick Add recommended item directly to the user's Vault
    const handleAddRecommendationToVault = async (media) => {
        const loadingToast = toast.loading(`Adding "${media.title || media.name}" to Vault...`);
        const status = "Plan to Watch";

        const normalizedMedia = {
            id: media.id,
            title: media.title || media.name,
            name: media.title || media.name,
            media_type: media.media_type,
            poster_path: media.poster_path,
            backdrop_path: media.backdrop_path,
            vote_average: media.vote_average,
            overview: media.overview,
            release_date: media.release_date || media.first_air_date
        };

        const response = await addToVault(currentUser.uid, normalizedMedia, status);
        if (response.success) {
            toast.success("Added to Vault!", { id: loadingToast });
            
            // Remove the added item from the recommendations list dynamically so the user gets fresh cards
            setPersonalizedRecs(prev => prev.filter(r => r.id !== media.id));
            
            // Real-time sync will handle adding to vault
        } else {
            toast.error("Failed to add item.", { id: loadingToast });
        }
    };



    if (loading || vaultLoading) {
        return (
            <div className="page container">
                <div className="loading-state">
                    <div className="spinner" />
                    <span className="loading-state__label">
                        Curating your customized recommendations…
                    </span>
                </div>
            </div>
        );
    }

    const renderMediaGrid = (recs, isPersonalized = false) => (
        <div className="tile-grid">
            {recs.map((rec) => {
                const recTitle = rec.title || rec.name;
                const rating = rec.vote_average ? Math.round(rec.vote_average * 10) / 10 : 'N/A';
                const poster = rec.poster_path
                    ? (rec.poster_path.startsWith("http://") || rec.poster_path.startsWith("https://") ? rec.poster_path : `https://image.tmdb.org/t/p/w342${rec.poster_path}`)
                    : null;
                const isMovie = rec.media_type === 'movie';

                return (
                    <div
                        key={rec.id}
                        className="media-tile"
                        onClick={() => setSelectedMedia(rec)}
                    >
                        {/* Poster Box */}
                        <div className="media-tile__poster-wrap">
                            {poster ? (
                                <img
                                    src={poster}
                                    alt={recTitle}
                                    className="media-tile__poster"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="media-tile__poster-fallback">No Poster</div>
                            )}

                            {/* Rating Badge */}
                            <div className="media-tile__rating">
                                <Star size={12} fill="currentColor" /> {rating}
                            </div>

                            {/* Media Type Label */}
                            <div className="media-tile__type">
                                {isMovie ? 'Movie' : 'TV'}
                            </div>
                        </div>

                        {/* Info Block */}
                        <div className="media-tile__body">
                            <div>
                                <h4 className="media-tile__title" title={recTitle}>
                                    {recTitle}
                                </h4>

                                {isPersonalized && rec.recommendedBy && (
                                    <span className="media-tile__hint">
                                        Inspired by {rec.recommendedBy}
                                    </span>
                                )}
                            </div>

                            {/* Actions Container */}
                            <div className="media-tile__actions">
                                <button
                                    className="btn btn--soft btn--xs btn--flex"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddRecommendationToVault(rec);
                                    }}
                                >
                                    <Plus size={14} /> Add
                                </button>
                                <button
                                    className="btn btn--ghost btn--xs btn--icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMedia(rec);
                                    }}
                                    title="View Details"
                                    aria-label={`View details for ${recTitle}`}
                                >
                                    <Info size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="page container">
            <div className="page-header">
                <div className="page-heading">
                    <h1 className="page-title">
                        <Sparkles size={28} /> Discover Hub
                    </h1>
                    <p className="page-subtitle">
                        AI-powered watchlist recommendations tailored strictly to your unique media tastes.
                    </p>
                </div>
            </div>

            {!isOnline && (
                <div className="banner banner--error">
                    You are currently offline. Recommendations require an active internet connection.
                </div>
            )}

            {/* RECOMMENDATIONS HUD NAVIGATION & FILTER TABS */}
            {personalizedRecs.length > 0 && (
                <div className="toolbar">
                    <FilterTabs
                        options={[
                            { value: 'all', label: 'All Matches' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'tv', label: 'TV Series' }
                        ]}
                        activeOption={filterType}
                        onChange={handleFilterChange}
                        className="chip-group--flush"
                    />

                    <div className="toolbar-spacer" />

                    <div className="section-meta">
                        Showing {Math.min(visibleCount, filteredRecommendations.length)} of {filteredRecommendations.length} Curated Matches
                    </div>
                </div>
            )}

            {/* PERSONALIZED RECOMMENDATIONS SECTION */}
            {visibleRecommendations.length > 0 ? (
                <div>
                    {renderMediaGrid(visibleRecommendations, true)}

                    {/* SHOW MORE OPTIONS BUTTON */}
                    {filteredRecommendations.length > visibleCount && (
                        <div className="show-more-row">
                            <button
                                className="show-more-btn"
                                onClick={() => setVisibleCount(prev => prev + 8)}
                            >
                                Show More Options <ChevronDown size={16} />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state warning/educational block if watchlist has no items yet */
                vaultItems.length === 0 && !loading ? (
                    <EmptyState
                        icon="library"
                        title="Your watchlist is empty!"
                        message="Add movies and TV series to your Vault and mark them as Completed or Watching, and we will unlock hyper-personalized matches!"
                        actionText="Go search items"
                        onAction={() => navigate("/")}
                    />
                ) : (
                    /* If active items filters are empty */
                    <EmptyState
                        icon="search"
                        title="No recommendations found"
                        message="Try adding more titles to your vault or mark some as Completed/Watching to improve recommendations."
                    />
                )
            )}

            {/* Interactive TMDb Details Modal */}
            {selectedMedia && (
                <Suspense fallback={null}>
                    <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
                </Suspense>
            )}
        </div>
    );
}

export default Recommendations;
