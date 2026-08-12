import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { searchMedia, getTrending } from "../services/tmdbApi";
import { searchAnime, getTrendingAnime, convertAnilistToTmdbFormat } from "../services/anilistApi";
import { addToVault, updateVaultItemProgress, updateVaultItemStatus } from "../services/firestoreService";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import SearchBar from "../components/SearchBar";
import MediaCard from "../components/MediaCard";
import FilterTabs from "../components/FilterTabs";
import { ArrowLeft, Play } from "lucide-react";

const MediaModal = lazy(() => import("../components/MediaModal"));

function Home() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [currentQuery, setCurrentQuery] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [isTrending, setIsTrending] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { isInVault, getWatchingItems } = useVault();
    const [contentType, setContentType] = useState("all"); // all, movies, tv, anime

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

    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const loadTrending = useCallback(async () => {
        setLoading(true);
        setIsTrending(true);
        setCurrentQuery("");
        try {
            if (contentType === "anime") {
                const data = await getTrendingAnime(1, 20);
                const convertedData = data.media.map(convertAnilistToTmdbFormat);
                setResults(convertedData);
                setPage(1);
                setHasMore(data.pageInfo.hasNextPage);
            } else {
                const data = await getTrending(1);
                let filteredData = data.results;
                if (contentType === "movies") {
                    filteredData = data.results.filter(item => item.media_type === 'movie');
                } else if (contentType === "tv") {
                    filteredData = data.results.filter(item => item.media_type === 'tv');
                } else {
                    filteredData = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                }
                setResults(filteredData);
                setPage(1);
                setHasMore(data.page < data.total_pages);
            }
        } catch (err) {
            setError("Failed to fetch trending media.");
        } finally {
            setLoading(false);
        }
    }, [contentType]);

    useEffect(() => {
        loadTrending();
    }, [loadTrending]);

    const handleSearch = async (query) => {
        if (!query) {
            loadTrending();
            return;
        }
        setLoading(true);
        setError(null);
        setCurrentQuery(query);
        setIsTrending(false);
        try {
            if (contentType === "anime") {
                const data = await searchAnime(query, 1, 20);
                const convertedData = data.media.map(convertAnilistToTmdbFormat);
                setResults(convertedData);
                setPage(1);
                setHasMore(data.pageInfo.hasNextPage);
            } else {
                const data = await searchMedia(query, 1);
                let filteredData = data.results;
                if (contentType === "movies") {
                    filteredData = data.results.filter(item => item.media_type === 'movie');
                } else if (contentType === "tv") {
                    filteredData = data.results.filter(item => item.media_type === 'tv');
                } else {
                    filteredData = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                }
                setResults(filteredData);
                setPage(1);
                setHasMore(data.page < data.total_pages);
            }
        } catch (err) {
            setError("Failed to fetch search results.");
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        const nextPage = page + 1;
        try {
            let newData;
            if (contentType === "anime") {
                if (isTrending) {
                    newData = await getTrendingAnime(nextPage, 20);
                } else {
                    newData = await searchAnime(currentQuery, nextPage, 20);
                }
                const convertedData = newData.media.map(convertAnilistToTmdbFormat);
                setResults([...results, ...convertedData]);
                setPage(nextPage);
                setHasMore(newData.pageInfo.hasNextPage);
            } else {
                let data;
                if (isTrending) {
                    data = await getTrending(nextPage);
                } else {
                    data = await searchMedia(currentQuery, nextPage);
                }
                let filteredData = data.results;
                if (contentType === "movies") {
                    filteredData = data.results.filter(item => item.media_type === 'movie');
                } else if (contentType === "tv") {
                    filteredData = data.results.filter(item => item.media_type === 'tv');
                } else {
                    filteredData = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                }
                setResults([...results, ...filteredData]);
                setPage(nextPage);
                setHasMore(data.page < data.total_pages);
            }
        } catch (err) {
            toast.error("Failed to load more results.");
        }
    };

    const handleAddToVault = async (item) => {
        if (!currentUser) {
            navigate("/login");
            return;
        }

        if (isInVault(item.id)) {
            toast.error("This item is already in your vault!");
            return;
        }

        const title = item.title || item.name;
        const loadingToast = toast.loading(`Adding ${title}...`);
        
        const response = await addToVault(currentUser.uid, item);
        if (response.success) {
            toast.success(`${title} added to your vault!`, { id: loadingToast });
        } else {
            toast.error("Failed to add to vault. Please try again.", { id: loadingToast });
        }
    };

    const handleNextEpisode = async (item) => {
        if (item.type === 'movie') {
            // Mark movie as completed
            const response = await updateVaultItemStatus(item.id, 'Completed');
            if (response.success) {
                toast.success(`${item.title} marked as completed!`);
            } else {
                toast.error("Failed to update status.");
            }
        } else {
            // Increment episode for TV/Anime
            const nextEpisode = (item.episode || 0) + 1;
            const response = await updateVaultItemProgress(item.id, item.season || 1, nextEpisode);
            if (response.success) {
                toast.success(`Progress updated to S${item.season || 1} E${nextEpisode}`);
            } else {
                toast.error("Failed to update progress.");
            }
        }
    };


    return (
        <div className="page container">
            <h1 className="page-title" style={{ textAlign: "center" }}>Discover & Vault</h1>
            <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "40px" }}>
                Search for your favorite movies, TV series, or anime and save them for later.
            </p>
            
            <SearchBar query={currentQuery} setQuery={setCurrentQuery} onSearch={handleSearch} />

            {/* Continue Watching Section */}
            {currentUser && getWatchingItems().length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Play size={24} style={{ color: 'var(--accent-primary)' }} />
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Continue Watching</h2>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '16px'
                    }}>
                        {getWatchingItems()
                            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
                            .slice(0, 6)
                            .map((item) => (
                                <div 
                                    key={item.id}
                                    onClick={() => setSelectedMedia(item)}
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: 'var(--glass-border)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        display: 'flex',
                                        gap: '16px',
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
                                    <img 
                                        src={item.poster ? `https://image.tmdb.org/t/p/w200${item.poster}` : 'https://via.placeholder.com/100x150?text=No+Poster'}
                                        alt={item.title}
                                        style={{
                                            width: '80px',
                                            height: '120px',
                                            objectFit: 'cover',
                                            borderRadius: '8px',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 }}>
                                                {item.title}
                                            </h3>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                {item.type === 'movie' ? 'Movie' : item.type === 'anime' ? 'Anime' : 'TV Series'}
                                            </div>
                                        </div>
                                        <div>
                                            {item.type !== 'movie' && (
                                                <div style={{ marginBottom: '8px' }}>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        fontSize: '0.8rem', 
                                                        color: 'var(--text-secondary)', 
                                                        marginBottom: '4px' 
                                                    }}>
                                                        <span>S{item.season || 1} E{item.episode || 0}</span>
                                                        <span>Progress</span>
                                                    </div>
                                                    <div style={{
                                                        height: '6px',
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${Math.min((item.episode || 0) / 12 * 100, 100)}%`,
                                                            background: 'var(--accent-primary)',
                                                            borderRadius: '3px',
                                                            transition: 'width 0.3s ease'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            )}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleNextEpisode(item);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    background: 'var(--accent-primary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--accent-hover)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'var(--accent-primary)';
                                                }}
                                            >
                                                <Play size={14} /> {item.type === 'movie' ? 'Mark Completed' : 'Next Episode'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Content Type Filter */}
            <FilterTabs 
                options={[
                    { value: 'all', label: 'All' },
                    { value: 'movies', label: 'Movies' },
                    { value: 'tv', label: 'TV Series' },
                    { value: 'anime', label: 'Anime' }
                ]}
                activeOption={contentType}
                onChange={(value) => {
                    setContentType(value);
                    loadTrending();
                }}
                style={{ justifyContent: 'center', marginBottom: '30px' }}
            />

            {!isOnline && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '30px',
                    textAlign: 'center',
                    color: '#f87171',
                    fontSize: '0.9rem',
                    maxWidth: '600px',
                    margin: '0 auto 30px'
                }}>
                    You are currently offline. Search is unavailable, but you can browse your Vault.
                </div>
            )}

            {!isTrending && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                    <button 
                        className="btn btn-outline" 
                        onClick={() => {
                            setCurrentQuery("");
                            loadTrending();
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', fontSize: '0.9rem' }}
                    >
                        <ArrowLeft size={16} /> Back to Trending
                    </button>
                </div>
            )}

            {isTrending && !loading && !error && (
                <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>
                    {contentType === 'anime' ? 'Trending Anime' : 
                     contentType === 'movies' ? 'Trending Movies' : 
                     contentType === 'tv' ? 'Trending TV Series' : 
                     'Trending This Week'}
                </h2>
            )}

            {!isTrending && !loading && !error && results.length > 0 && (
                <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>Search Results for "{currentQuery}"</h2>
            )}

            {loading && page === 1 && (
                <>
                    <style>{`
                        @keyframes skeletonPulse {
                            0% { background-position: 200% 0; }
                            100% { background-position: -200% 0; }
                        }
                    `}</style>
                    <div className="media-grid" style={{ marginBottom: '40px' }}>
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="skeleton-card" style={{
                                borderRadius: '12px',
                                aspectRatio: '2 / 3',
                                background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.02) 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'skeletonPulse 1.5s infinite linear',
                                border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}></div>
                        ))}
                    </div>
                </>
            )}
            {error && <div style={{ color: "#f87171", textAlign: "center" }}>{error}</div>}

            {!loading && !error && results.length > 0 && (
                <>
                    <div className="media-grid">
                        {results.map((item, index) => (
                            <MediaCard 
                                key={`${item.id}-${index}`} 
                                item={item} 
                                onAdd={handleAddToVault}
                                onClick={() => setSelectedMedia(item)}
                                isAdded={isInVault(item.id)}
                            />
                        ))}
                    </div>
                    
                    {hasMore && (
                        <div style={{ textAlign: 'center', marginTop: '40px' }}>
                            <button className="btn btn-outline" onClick={loadMore}>
                                Load More
                            </button>
                        </div>
                    )}
                </>
            )}
            
            {!loading && !error && results.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "40px" }}>
                    No results to display. Try searching for something else!
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

export default Home;
