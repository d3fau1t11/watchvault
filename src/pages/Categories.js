import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { addToVault } from "../services/firestoreService";
import { getMovieGenres, getTVGenres, discoverMedia } from "../services/tmdbApi";
import { FolderOpen, Star, Plus, Info, Check, ChevronDown, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const MediaModal = lazy(() => import("../components/MediaModal"));

/* One solid hue per genre, used only as a 3px keyline on the tile.
   Enough to make the grid scannable without turning it into a paint chart. */
const GENRE_ACCENTS = [
    "#E50914", // Red
    "#3B82F6", // Blue
    "#22C55E", // Green
    "#F5A524", // Amber
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#6366F1", // Indigo
    "#14B8A6"  // Teal
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
            <div className="page-header">
                <div className="page-heading">
                    <h1 className="page-title">
                        <FolderOpen size={28} /> Categories
                    </h1>
                </div>

                {/* Media Type Selector */}
                <div className="segmented" role="group" aria-label="Media type">
                    <button
                        type="button"
                        className={`segmented-btn${mediaType === "movie" ? ' segmented-btn--active' : ''}`}
                        aria-pressed={mediaType === "movie"}
                        onClick={() => setMediaType("movie")}
                    >
                        Movies
                    </button>
                    <button
                        type="button"
                        className={`segmented-btn${mediaType === "tv" ? ' segmented-btn--active' : ''}`}
                        aria-pressed={mediaType === "tv"}
                        onClick={() => setMediaType("tv")}
                    >
                        TV Series
                    </button>
                </div>
            </div>

            {loadingGenres ? (
                <div className="state-note">Loading category lists…</div>
            ) : (
                <>
                    {/* Categories Grid */}
                    <div className="genre-grid">
                        {genres.map((genre, index) => {
                            const accent = GENRE_ACCENTS[index % GENRE_ACCENTS.length];
                            const isSelected = selectedGenre?.id === genre.id;

                            return (
                                <button
                                    key={genre.id}
                                    type="button"
                                    className={`genre-tile${isSelected ? ' genre-tile--active' : ''}${selectedGenre && !isSelected ? ' genre-tile--dimmed' : ''}`}
                                    style={{ '--genre-accent': accent }}
                                    aria-pressed={isSelected}
                                    onClick={() => handleSelectGenre(genre)}
                                >
                                    <span className="genre-tile__label">{genre.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Results Section */}
                    {selectedGenre ? (
                        <div className="category-results">
                            <div className="section-header section-rule">
                                <h2 className="section-title">
                                    Popular {selectedGenre.name} {mediaType === "movie" ? "Movies" : "TV Series"}
                                </h2>
                            </div>

                            {titles.length > 0 ? (
                                <>
                                    <div className="tile-grid">
                                        {titles.map((item) => {
                                            const rating = item.vote_average ? Math.round(item.vote_average * 10) / 10 : 'N/A';
                                            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
                                            const itemAdded = item.isAdded || isInVault(item.id);
                                            const itemTitle = item.title || item.name;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="media-tile"
                                                    onClick={() => setSelectedMedia(item)}
                                                >
                                                    <div className="media-tile__poster-wrap">
                                                        {poster ? (
                                                            <img
                                                                src={poster}
                                                                alt={itemTitle}
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
                                                    </div>

                                                    <div className="media-tile__body">
                                                        <h4 className="media-tile__title" title={itemTitle}>
                                                            {itemTitle}
                                                        </h4>

                                                        <div className="media-tile__actions" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                className="btn btn--ghost btn--xs btn--flex"
                                                                onClick={() => setSelectedMedia(item)}
                                                                title="View Details"
                                                            >
                                                                <Info size={14} /> Details
                                                            </button>

                                                            <button
                                                                className={`btn btn--xs btn--flex${itemAdded ? ' btn--success' : ''}`}
                                                                onClick={() => handleAddGenreItemToVault(item)}
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
                                        <div className="show-more-row">
                                            <button
                                                className="show-more-btn"
                                                onClick={handleLoadMore}
                                                disabled={loadingTitles}
                                            >
                                                {loadingTitles ? (
                                                    <>
                                                        <RefreshCw size={16} className="spinner-icon" />
                                                        Loading more…
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
                                <div className="state-note">
                                    {loadingTitles ? "Fetching titles…" : "No titles found in this category."}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty empty--dashed">
                            <FolderOpen size={44} className="empty-icon" />
                            <h3 className="empty-title">Choose a category</h3>
                            <p className="empty-text">
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
