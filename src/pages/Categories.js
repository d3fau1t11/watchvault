import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { addToVault } from "../services/firestoreService";
import { getMovieGenres, getTVGenres, discoverMedia } from "../services/tmdbApi";
import { FolderOpen, Star, Plus, Info, Check, ChevronDown, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const MediaModal = lazy(() => import("../components/MediaModal"));

const CARD_GRADIENTS = [
    "linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)", // Red
    "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", // Blue
    "linear-gradient(135deg, #10b981 0%, #047857 100%)", // Green
    "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", // Yellow
    "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", // Purple
    "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", // Pink
    "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", // Cyan
    "linear-gradient(135deg, #f97316 0%, #c2410c 100%)", // Orange
    "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", // Indigo
    "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"  // Teal
];

function Categories() {
    const { currentUser } = useAuth();
    const { isInVault } = useVault();
    const [mediaType, setMediaType] = useState("movie"); // movie or tv
    const [genres, setGenres] = useState([]);
    const [loadingGenres, setLoadingGenres] = useState(true);
    
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [titles, setTitles] = useState([]);
    const [loadingTitles, setLoadingTitles] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    
    const [selectedMedia, setSelectedMedia] = useState(null);

    // Fetch genres list on mediaType change
    useEffect(() => {
        const fetchGenres = async () => {
            setLoadingGenres(true);
            setSelectedGenre(null);
            setTitles([]);
            try {
                const res = mediaType === "movie" ? await getMovieGenres() : await getTVGenres();
                if (res && res.genres) {
                    setGenres(res.genres);
                } else {
                    setGenres([]);
                }
            } catch (err) {
                console.error("Failed to load genres list:", err);
                toast.error("Could not fetch categories.");
            } finally {
                setLoadingGenres(false);
            }
        };

        fetchGenres();
    }, [mediaType]);

    // Fetch titles when selectedGenre or page changes
    useEffect(() => {
        if (!selectedGenre) return;

        const fetchTitles = async () => {
            setLoadingTitles(true);
            try {
                const isAdult = selectedGenre.id === "adult";
                const genreId = isAdult ? null : selectedGenre.id;
                const data = await discoverMedia(mediaType, page, genreId, isAdult);
                if (data && data.results) {
                    const resultsWithType = data.results.map(r => ({ ...r, media_type: mediaType }));
                    if (page === 1) {
                        setTitles(resultsWithType);
                    } else {
                        setTitles(prev => [...prev, ...resultsWithType]);
                    }
                    setHasMore(data.page < data.total_pages && data.page < 50); // limit page queries
                }
            } catch (err) {
                console.error("Failed to load discover titles:", err);
                toast.error("Could not load category titles.");
            } finally {
                setLoadingTitles(false);
            }
        };

        fetchTitles();
    }, [selectedGenre, page, mediaType]);

    const handleSelectGenre = (genre) => {
        setSelectedGenre(genre);
        setPage(1);
        setTitles([]);
    };

    const handleLoadMore = () => {
        if (loadingTitles || !hasMore) return;
        setPage(prev => prev + 1);
    };

    const handleAddGenreItemToVault = async (item) => {
        const loadingToast = toast.loading(`Adding "${item.title || item.name}" to Vault...`);
        const status = "Plan to Watch";

        const normalizedMedia = {
            id: item.id,
            title: item.title || item.name,
            name: item.title || item.name,
            media_type: mediaType,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            vote_average: item.vote_average,
            overview: item.overview,
            release_date: item.release_date || item.first_air_date
        };

        const response = await addToVault(currentUser.uid, normalizedMedia, status);
        if (response.success) {
            toast.success("Added to Vault!", { id: loadingToast });
            // Refresh to trigger re-render of button
            setTitles(prev => prev.map(t => t.id === item.id ? { ...t, isAdded: true } : t));
        } else {
            toast.error("Failed to add item.", { id: loadingToast });
        }
    };

    return (
        <div className="page container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="page-title" style={{ marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <FolderOpen size={32} style={{ color: '#ff4b4b' }} /> Categories
                </h1>

                {/* Media Type Selector */}
                <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                    <button 
                        onClick={() => setMediaType("movie")}
                        style={{
                            background: mediaType === "movie" ? 'var(--accent-primary)' : 'transparent',
                            border: 'none',
                            color: 'white',
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'background 0.2s'
                        }}
                    >
                        Movies
                    </button>
                    <button 
                        onClick={() => setMediaType("tv")}
                        style={{
                            background: mediaType === "tv" ? 'var(--accent-primary)' : 'transparent',
                            border: 'none',
                            color: 'white',
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'background 0.2s'
                        }}
                    >
                        TV Series
                    </button>
                </div>
            </div>

            {loadingGenres ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>Loading category lists...</div>
            ) : (
                <>
                    {/* Categories Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '16px',
                        marginBottom: '40px'
                    }}>
                        {genres.map((genre, index) => {
                            const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                            const isSelected = selectedGenre?.id === genre.id;

                            return (
                                <div
                                    key={genre.id}
                                    onClick={() => handleSelectGenre(genre)}
                                    style={{
                                        background: gradient,
                                        borderRadius: '12px',
                                        height: '75px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: isSelected ? '0 0 15px rgba(255,255,255,0.3)' : 'var(--shadow-sm)',
                                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                        opacity: selectedGenre && !isSelected ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.transform = 'translateY(-3px)';
                                            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.3)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', textAlign: 'center', padding: '0 10px' }}>
                                        {genre.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Results Section */}
                    {selectedGenre ? (
                        <div style={{ animation: 'statsFadeIn 0.4s ease' }}>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Popular {selectedGenre.name} {mediaType === "movie" ? "Movies" : "TV Series"}
                                </h2>
                            </div>

                            {titles.length > 0 ? (
                                <>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                                        gap: '24px',
                                        marginBottom: '30px'
                                    }}>
                                        {titles.map((item) => {
                                            const rating = item.vote_average ? Math.round(item.vote_average * 10) / 10 : 'N/A';
                                            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
                                            const itemAdded = item.isAdded || isInVault(item.id);

                                            return (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => setSelectedMedia(item)}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                                        borderRadius: '12px',
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        position: 'relative'
                                                    }}
                                                    className="rec-card-full"
                                                >
                                                    <div style={{ height: '240px', overflow: 'hidden', position: 'relative' }}>
                                                        {poster ? (
                                                            <img src={poster} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                                    </div>

                                                    <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                                                            {item.title || item.name}
                                                        </h4>
                                                        
                                                        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }} onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                className="btn btn-outline" 
                                                                onClick={() => setSelectedMedia(item)}
                                                                style={{ padding: '6px', flex: 1, fontSize: '0.75rem', minWidth: 0 }}
                                                                title="View Details"
                                                            >
                                                                <Info size={14} /> Details
                                                            </button>
                                                            
                                                            <button 
                                                                className="btn" 
                                                                onClick={() => handleAddGenreItemToVault(item)}
                                                                style={{ 
                                                                    padding: '6px', 
                                                                    flex: 1, 
                                                                    fontSize: '0.75rem', 
                                                                    minWidth: 0,
                                                                    background: itemAdded ? '#22c55e' : 'var(--accent-primary)',
                                                                    borderColor: itemAdded ? '#22c55e' : 'var(--accent-primary)',
                                                                    color: 'white'
                                                                }}
                                                                disabled={itemAdded}
                                                            >
                                                                {itemAdded ? <Check size={14} /> : <Plus size={14} />} Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {hasMore && (
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px', marginBottom: '40px' }}>
                                            <button 
                                                className="btn btn-outline" 
                                                onClick={handleLoadMore} 
                                                disabled={loadingTitles}
                                                style={{ padding: '10px 24px', fontSize: '0.95rem' }}
                                            >
                                                {loadingTitles ? (
                                                    <>
                                                        <RefreshCw size={16} className="spinning-icon" style={{ animation: 'appSpin 1s linear infinite' }} />
                                                        Loading more...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown size={18} /> Load More
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    {loadingTitles ? "Fetching titles..." : "No titles found in this category."}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px dashed rgba(255,255,255,0.08)',
                            borderRadius: '16px',
                            padding: '60px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)'
                        }}>
                            <FolderOpen size={48} style={{ color: 'rgba(229, 9, 20, 0.2)', marginBottom: '16px' }} />
                            <h3>Choose a Category</h3>
                            <p style={{ maxWidth: '400px', fontSize: '0.9rem', marginTop: '6px' }}>
                                Select one of the genres above to explore popular {mediaType === "movie" ? "movies" : "TV shows"}.
                            </p>
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

export default Categories;
