import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { addToVault } from "../services/firestoreService";
import { getTrending, discoverMedia } from "../services/tmdbApi";
import { getTrendingAnime, convertAnilistToTmdbFormat } from "../services/anilistApi";
import { Shuffle as ShuffleIcon, Sparkles, Star, Plus, Info, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const MediaModal = lazy(() => import("../components/MediaModal"));

const CATEGORY_TO_GENRE_ID = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35, "Crime": 80,
    "Documentary": 99, "Drama": 18, "Family": 10751, "Fantasy": 14, "History": 36,
    "Horror": 27, "Music": 10402, "Mystery": 9648, "Romance": 10749, "Sci-Fi": 878,
    "Thriller": 53, "War": 10752, "Western": 37
};

const TV_CATEGORY_TO_GENRE_ID = {
    "Action": 10759, "Adventure": 10759, "Animation": 16, "Comedy": 35, "Crime": 80,
    "Documentary": 99, "Drama": 18, "Family": 10751, "Fantasy": 10765, "Horror": 27,
    "Mystery": 9648, "Romance": 10749, "Sci-Fi": 10765, "Thriller": 53, "Western": 37
};

const SHUFFLE_CATEGORIES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", 
    "Drama", "Family", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", 
    "Thriller", "Western"
];

function Shuffle() {
    const { currentUser } = useAuth();
    const { vaultItems, isInVault, loading: vaultLoading } = useVault();
    const [source, setSource] = useState("watchlist"); // watchlist or external
    const [typeFilter, setTypeFilter] = useState("all"); // all, movie, tv, anime
    const [categoryFilter, setCategoryFilter] = useState("all"); // all, or specific string
    const [excludeWatched, setExcludeWatched] = useState(true); // Exclude completed items
    
    const [shuffling, setShuffling] = useState(false);
    const [shuffledItem, setShuffledItem] = useState(null);
    const [spinningPoster, setSpinningPoster] = useState(null);
    const [selectedMedia, setSelectedMedia] = useState(null);

    // List of fallback cycle posters (trending covers) to spin when source is empty or external
    const [trendingCyclePosters, setTrendingCyclePosters] = useState([]);

    useEffect(() => {
        const fetchCyclePosters = async () => {
            try {
                const data = await getTrending(1, "all");
                if (data && data.results) {
                    setTrendingCyclePosters(data.results.map(r => r.poster_path).filter(Boolean));
                }
            } catch (e) {
                console.error("Failed to load trending cycle posters", e);
            }
        };
        fetchCyclePosters();
    }, []);

    // Get categories present in the user's vault to display when shuffling "from watchlist"
    const watchlistCategories = useMemo(() => {
        const categoriesSet = new Set();
        vaultItems.forEach(item => {
            const cat = item.category || "Uncategorized";
            categoriesSet.add(cat);
        });
        return Array.from(categoriesSet).sort();
    }, [vaultItems]);

    const categoriesPool = useMemo(() => {
        const set = new Set(SHUFFLE_CATEGORIES);
        watchlistCategories.forEach(c => set.add(c));
        return Array.from(set).sort();
    }, [watchlistCategories]);

    const handleShuffle = async () => {
        if (shuffling) return;

        if (source === "watchlist") {
            // Filter watchlist items
            let pool = [...vaultItems];

            if (typeFilter !== "all") {
                pool = pool.filter(item => item.type === typeFilter);
            }
            if (categoryFilter !== "all") {
                pool = pool.filter(item => {
                    const itemCat = item.category || "Uncategorized";
                    return itemCat === categoryFilter;
                });
            }
            if (excludeWatched) {
                pool = pool.filter(item => item.status !== "Completed");
            }

            if (pool.length === 0) {
                toast.error("No items in your watchlist match the current filters.");
                return;
            }

            const chosen = pool[Math.floor(Math.random() * pool.length)];
            
            // Run slots animation
            // Combine current pool with fallback cycle posters to make the spin more diverse
            const spinPool = pool.length > 5 ? pool : [...pool, ...trendingCyclePosters.map(p => ({ poster_path: p }))];
            runSpinningAnimation(spinPool, chosen);
        } else {
            // Shuffle from external discover API
            setShuffling(true);
            setShuffledItem(null);
            
            try {
                let chosen = null;
                const randomPage = Math.floor(Math.random() * 5) + 1; // Random page 1 to 5

                if (typeFilter === "anime") {
                    const data = await getTrendingAnime(randomPage, 20);
                    if (data && data.media) {
                        const formatted = data.media.map(convertAnilistToTmdbFormat);
                        // Filter out items already in the vault
                        const filtered = formatted.filter(item => !isInVault(item.id));
                        const pool = filtered.length > 0 ? filtered : formatted;
                        chosen = pool[Math.floor(Math.random() * pool.length)];
                    }
                } else if (typeFilter === "movie" || typeFilter === "tv") {
                    const isAdult = categoryFilter === "Adult";
                    const genreId = (categoryFilter !== "all" && !isAdult) ? 
                        (typeFilter === "movie" ? CATEGORY_TO_GENRE_ID[categoryFilter] : TV_CATEGORY_TO_GENRE_ID[categoryFilter]) : 
                        null;
                    
                    const data = await discoverMedia(typeFilter, randomPage, genreId, isAdult);
                    if (data && data.results && data.results.length > 0) {
                        const resultsWithType = data.results.map(r => ({ ...r, media_type: typeFilter }));
                        // Filter out items already in the vault
                        const filtered = resultsWithType.filter(item => !isInVault(item.id));
                        const pool = filtered.length > 0 ? filtered : resultsWithType;
                        chosen = pool[Math.floor(Math.random() * pool.length)];
                    }
                } else {
                    // Type is "all" - pick movie or tv randomly
                    const chosenType = Math.random() > 0.5 ? "movie" : "tv";
                    const isAdult = categoryFilter === "Adult";
                    const genreId = (categoryFilter !== "all" && !isAdult) ? 
                        (chosenType === "movie" ? CATEGORY_TO_GENRE_ID[categoryFilter] : TV_CATEGORY_TO_GENRE_ID[categoryFilter]) : 
                        null;

                    const data = await discoverMedia(chosenType, randomPage, genreId, isAdult);
                    if (data && data.results && data.results.length > 0) {
                        const resultsWithType = data.results.map(r => ({ ...r, media_type: chosenType }));
                        const filtered = resultsWithType.filter(item => !isInVault(item.id));
                        const pool = filtered.length > 0 ? filtered : resultsWithType;
                        chosen = pool[Math.floor(Math.random() * pool.length)];
                    }
                }

                if (!chosen) {
                    toast.error("Failed to find any matching external media. Try changing filters.");
                    setShuffling(false);
                    return;
                }

                // Run slots animation
                runSpinningAnimation(trendingCyclePosters.map(p => ({ poster_path: p })), chosen);

            } catch (err) {
                console.error("External shuffle error:", err);
                toast.error("Network error while trying to fetch suggestions.");
                setShuffling(false);
            }
        }
    };

    const runSpinningAnimation = (spinPool, finalSelected) => {
        setShuffling(true);
        setShuffledItem(null);
        let count = 0;
        const maxCycles = 15;
        const interval = setInterval(() => {
            const randomItem = spinPool[Math.floor(Math.random() * spinPool.length)];
            const poster = randomItem?.poster || randomItem?.poster_path;
            if (poster) {
                setSpinningPoster(poster.startsWith("http") ? poster : `https://image.tmdb.org/t/p/w342${poster}`);
            }
            count++;
            if (count >= maxCycles) {
                clearInterval(interval);
                setShuffling(false);
                setShuffledItem(finalSelected);
                setSpinningPoster(null);
            }
        }, 100);
    };

    const handleAddShuffledToVault = async (item) => {
        const loadingToast = toast.loading(`Adding "${item.title || item.name}" to Vault...`);
        const status = "Plan to Watch";

        const normalizedMedia = {
            id: item.id,
            title: item.title || item.name,
            name: item.title || item.name,
            media_type: item.media_type || (item.title ? 'movie' : 'tv'),
            poster_path: item.poster_path || item.poster,
            backdrop_path: item.backdrop_path,
            vote_average: item.vote_average,
            overview: item.overview,
            release_date: item.release_date || item.first_air_date
        };

        const response = await addToVault(currentUser.uid, normalizedMedia, status);
        if (response.success) {
            toast.success("Added to Vault!", { id: loadingToast });
            // Refresh state
            setShuffledItem(prev => prev ? { ...prev, isAdded: true } : null);
        } else {
            toast.error("Failed to add item.", { id: loadingToast });
        }
    };

    if (vaultLoading) {
        return <div className="page container" style={{ textAlign: "center" }}>Loading configuration...</div>;
    }

    const currentPoster = shuffledItem?.poster || shuffledItem?.poster_path;
    const finalPosterUrl = currentPoster ? 
        (currentPoster.startsWith("http") ? currentPoster : `https://image.tmdb.org/t/p/w500${currentPoster}`) : 
        'https://via.placeholder.com/350x500?text=No+Poster';

    const itemInVault = shuffledItem ? (shuffledItem.isAdded || isInVault(shuffledItem.tmdbId || shuffledItem.id)) : false;

    return (
        <div className="page container" style={{ maxWidth: '800px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 className="page-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <ShuffleIcon size={36} style={{ color: '#ff4b4b' }} /> Vault Randomizer
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Can't decide what to watch next? Let the Vault shuffle one for you!
                </p>
            </div>

            {/* Config Panels */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: 'var(--glass-border)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '30px',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {/* Source Selector */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                            Shuffle Source
                        </label>
                        <select 
                            value={source} 
                            onChange={(e) => {
                                setSource(e.target.value);
                                setCategoryFilter("all"); // Reset category filter
                            }}
                            className="status-select"
                            style={{ width: '100%', height: '42px' }}
                        >
                            <option value="watchlist">From My Watchlist</option>
                            <option value="external">Not From Watchlist (Discover)</option>
                        </select>
                    </div>

                    {/* Media Type Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                            Media Type
                        </label>
                        <select 
                            value={typeFilter} 
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="status-select"
                            style={{ width: '100%', height: '42px' }}
                        >
                            <option value="all">All Content</option>
                            <option value="movie">Movies</option>
                            <option value="tv">TV Series</option>
                            <option value="anime">Anime</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                            Category / Genre
                        </label>
                        <select 
                            value={categoryFilter} 
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="status-select"
                            style={{ width: '100%', height: '42px' }}
                        >
                            <option value="all">All Categories</option>
                            {categoriesPool.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {source === "watchlist" && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <input 
                            type="checkbox" 
                            id="excludeWatchedCheckbox" 
                            checked={excludeWatched} 
                            onChange={(e) => setExcludeWatched(e.target.checked)}
                            style={{ 
                                cursor: 'pointer',
                                accentColor: 'var(--accent-primary)',
                                width: '16px',
                                height: '16px'
                            }}
                        />
                        <label 
                            htmlFor="excludeWatchedCheckbox" 
                            style={{ 
                                fontSize: '0.85rem', 
                                color: 'var(--text-secondary)', 
                                fontWeight: 500, 
                                cursor: 'pointer',
                                userSelect: 'none'
                            }}
                        >
                            Exclude Completed (Watched) Titles
                        </label>
                    </div>
                )}

                <button 
                    onClick={handleShuffle} 
                    className="btn" 
                    disabled={shuffling}
                    style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)',
                        boxShadow: '0 8px 24px -6px rgba(229, 9, 20, 0.4)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '10px'
                    }}
                >
                    {shuffling ? (
                        <>
                            <RefreshCw size={20} className="spinning-icon" style={{ animation: 'appSpin 1s linear infinite' }} />
                            Shuffling the deck...
                        </>
                    ) : (
                        <>
                            <ShuffleIcon size={20} />
                            Shuffle Titles
                        </>
                    )}
                </button>
            </div>

            {/* Shuffle Screen / Results */}
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '400px' }}>
                {shuffling && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%'
                    }}>
                        <div 
                            className="shuffling-container-active"
                            style={{
                                width: '240px',
                                height: '360px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '2px dashed var(--accent-primary)',
                                boxShadow: '0 0 30px rgba(229, 9, 20, 0.2)',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}
                        >
                            {spinningPoster ? (
                                <img 
                                    src={spinningPoster} 
                                    alt="spinning" 
                                    className="shuffling-poster-active"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, filter: 'blur(1px)' }} 
                                />
                            ) : (
                                <ShuffleIcon size={48} className="spinning-icon" style={{ opacity: 0.3, color: 'var(--text-secondary)' }} />
                            )}
                            <div style={{
                                position: 'absolute',
                                bottom: '20px',
                                background: 'rgba(0,0,0,0.8)',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                                border: 'var(--glass-border)'
                            }}>
                                Cycling watchlist...
                            </div>
                        </div>
                    </div>
                )}

                {!shuffling && shuffledItem && (
                    <div style={{
                        display: 'flex',
                        gap: '24px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: 'var(--glass-border)',
                        borderRadius: '16px',
                        padding: '24px',
                        width: '100%',
                        animation: 'statsFadeIn 0.5s ease',
                        flexDirection: window.innerWidth < 600 ? 'column' : 'row'
                    }} className="shuffle-result-card">
                        <img 
                            src={finalPosterUrl} 
                            alt={shuffledItem.title || shuffledItem.name} 
                            style={{
                                width: '220px',
                                height: '330px',
                                objectFit: 'cover',
                                borderRadius: '12px',
                                flexShrink: 0,
                                boxShadow: 'var(--shadow-lg)',
                                alignSelf: 'center'
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ 
                                        background: 'rgba(229, 9, 20, 0.1)', 
                                        color: 'var(--accent-primary)', 
                                        padding: '3px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.72rem', 
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {shuffledItem.type === 'anime' ? 'Anime' : (shuffledItem.media_type === 'movie' || shuffledItem.type === 'movie' ? 'Movie' : 'TV Series')}
                                    </span>
                                    {shuffledItem.category && (
                                        <span style={{ 
                                            background: 'rgba(59, 130, 246, 0.15)', 
                                            color: '#60a5fa', 
                                            padding: '3px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.72rem', 
                                            fontWeight: 600,
                                            border: '1px solid rgba(59, 130, 246, 0.3)'
                                        }}>
                                            {shuffledItem.category}
                                        </span>
                                    )}
                                    {shuffledItem.vote_average > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600 }}>
                                            <Star size={14} fill="#fbbf24" color="#fbbf24" /> {shuffledItem.vote_average.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                                    {shuffledItem.title || shuffledItem.name}
                                </h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px', maxHeight: '150px', overflowY: 'auto' }}>
                                    {shuffledItem.overview || "No overview available for this title."}
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <button 
                                    className="btn btn-outline"
                                    onClick={() => setSelectedMedia(shuffledItem)}
                                    style={{ flex: 1, padding: '10px' }}
                                >
                                    <Info size={16} /> View Details
                                </button>
                                
                                {source === "external" && (
                                    <button 
                                        className="btn"
                                        onClick={() => handleAddShuffledToVault(shuffledItem)}
                                        disabled={itemInVault}
                                        style={{ 
                                            flex: 1, 
                                            padding: '10px',
                                            background: itemInVault ? '#22c55e' : 'var(--accent-primary)',
                                            borderColor: itemInVault ? '#22c55e' : 'var(--accent-primary)',
                                            color: 'white'
                                        }}
                                    >
                                        {itemInVault ? (
                                            <><Check size={16} /> In Your Vault</>
                                        ) : (
                                            <><Plus size={16} /> Add to Vault</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!shuffling && !shuffledItem && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        padding: '40px',
                        width: '100%',
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        <Sparkles size={48} style={{ color: 'rgba(229, 9, 20, 0.3)', marginBottom: '16px' }} />
                        <h3>Shuffler Standby</h3>
                        <p style={{ maxWidth: '400px', fontSize: '0.9rem', marginTop: '6px' }}>
                            Adjust the filters above and hit the shuffle button to pick a random title.
                        </p>
                    </div>
                )}
            </div>

            {selectedMedia && (
                <Suspense fallback={null}>
                    <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
                </Suspense>
            )}
        </div>
    );
}

export default Shuffle;
