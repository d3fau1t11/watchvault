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
            <div className="page container" style={{ textAlign: "center", padding: "100px 0" }}>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <div style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(229, 9, 20, 0.1)",
                    borderTopColor: "var(--accent-primary)",
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    animation: "spin 0.8s linear infinite"
                }}></div>
                <h3 style={{ color: "var(--text-secondary)" }}>Curating your customized recommendations...</h3>
            </div>
        );
    }

    const renderMediaGrid = (recs, isPersonalized = false) => (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '24px',
            marginBottom: '20px'
        }}>
            {recs.map((rec) => {
                const recTitle = rec.title || rec.name;
                const rating = rec.vote_average ? Math.round(rec.vote_average * 10) / 10 : 'N/A';
                const poster = rec.poster_path 
                    ? `https://image.tmdb.org/t/p/w342${rec.poster_path}`
                    : null;
                const isMovie = rec.media_type === 'movie';

                return (
                    <div 
                        key={rec.id} 
                        onClick={() => setSelectedMedia(rec)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            animation: 'statsFadeIn 0.4s ease'
                        }}
                        className="rec-card-full"
                    >
                        {/* Poster Box */}
                        <div style={{ height: '250px', overflow: 'hidden', position: 'relative' }}>
                            {poster ? (
                                <img src={poster} alt={recTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e222b' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No Poster</span>
                                </div>
                            )}
                            
                            {/* Rating Badge */}
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'rgba(0, 0, 0, 0.75)',
                                color: '#fbbf24',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <Star size={12} fill="#fbbf24" color="#fbbf24" /> {rating}
                            </div>

                            {/* Media Type Label */}
                            <div style={{
                                position: 'absolute',
                                bottom: '10px',
                                left: '10px',
                                background: isMovie ? 'rgba(229, 9, 20, 0.9)' : 'rgba(59, 130, 246, 0.9)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                backdropFilter: 'blur(2px)'
                            }}>
                                {isMovie ? 'Movie' : 'TV'}
                            </div>
                        </div>

                        {/* Info Block */}
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{
                                    margin: 0,
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }} title={recTitle}>
                                    {recTitle}
                                </h4>
                                
                                {isPersonalized && rec.recommendedBy && (
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-secondary)',
                                        display: 'block',
                                        marginTop: '4px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        Inspired by {rec.recommendedBy}
                                    </span>
                                )}
                            </div>

                            {/* Actions Container */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddRecommendationToVault(rec);
                                    }}
                                    style={{
                                        flex: 1,
                                        background: 'rgba(229, 9, 20, 0.1)',
                                        border: '1px solid rgba(229, 9, 20, 0.2)',
                                        color: 'var(--accent-primary)',
                                        borderRadius: '6px',
                                        padding: '6px 0',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        outline: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                    className="rec-action-add"
                                >
                                    <Plus size={14} /> Add
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMedia(rec);
                                    }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '6px',
                                        padding: '6px 8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                    className="rec-action-info"
                                    title="View Details"
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
            <style>{`
                .rec-card-full {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .rec-card-full:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.04) !important;
                    border-color: rgba(229, 9, 20, 0.2) !important;
                    box-shadow: 0 12px 24px -10px rgba(229, 9, 20, 0.25);
                }
                .rec-action-add:hover {
                    background: var(--accent-primary) !important;
                    border-color: var(--accent-primary) !important;
                    color: white !important;
                }
                .rec-action-info:hover {
                    background: rgba(255, 255, 255, 0.1) !important;
                }
                .show-more-btn {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .show-more-btn:hover {
                    background: rgba(255, 255, 255, 0.09) !important;
                    border-color: var(--accent-primary) !important;
                    color: #fff !important;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px -8px rgba(229, 9, 20, 0.3);
                }
            `}</style>

            <div style={{ marginBottom: "30px" }}>
                <h1 className="page-title" style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    <Sparkles size={28} style={{ color: "var(--accent-primary)" }} /> Discover Hub
                </h1>
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                    AI-powered watchlist recommendations tailored strictly to your unique media tastes.
                </p>
            </div>

            {!isOnline && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '24px',
                    textAlign: 'center',
                    color: '#f87171',
                    fontSize: '0.9rem'
                }}>
                    You are currently offline. Recommendations require an active internet connection.
                </div>
            )}

            {/* RECOMMENDATIONS HUD NAVIGATION & FILTER TABS */}
            {personalizedRecs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <FilterTabs 
                        options={[
                            { value: 'all', label: 'All Matches' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'tv', label: 'TV Series' }
                        ]}
                        activeOption={filterType}
                        onChange={handleFilterChange}
                    />
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
                        <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '50px' }}>
                            <button 
                                onClick={() => setVisibleCount(prev => prev + 8)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: 'var(--text-primary)',
                                    padding: '12px 28px',
                                    borderRadius: '24px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    outline: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                className="show-more-btn"
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
