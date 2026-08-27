import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { searchMedia, getTrending, getMediaDetails } from "../services/tmdbApi";
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
                const type = contentType === "movies" ? "movie" : contentType === "tv" ? "tv" : "all";
                const data = await getTrending(1, type);
                setResults(data.results);
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
                const type = contentType === "movies" ? "movie" : contentType === "tv" ? "tv" : "all";
                const data = await searchMedia(query, 1, type);
                setResults(data.results);
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
                const type = contentType === "movies" ? "movie" : contentType === "tv" ? "tv" : "all";
                if (isTrending) {
                    data = await getTrending(nextPage, type);
                } else {
                    data = await searchMedia(currentQuery, nextPage, type);
                }
                setResults([...results, ...data.results]);
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
                
                // Auto-complete if show is ended/canceled and all episodes are watched
                try {
                    let type = item.type;
                    if (type === 'anime') type = 'tv';
                    const details = await getMediaDetails(item.tmdbId, type);
                    const isEndedOrCanceled = details?.status === 'Ended' || details?.status === 'Canceled';
                    const nonZeroSeasons = details?.seasons?.filter(s => s.season_number > 0) || [];
                    const lastSeasonObj = nonZeroSeasons[nonZeroSeasons.length - 1];
                    
                    if (isEndedOrCanceled && lastSeasonObj) {
                        const currentSeason = item.season || 1;
                        if (currentSeason === lastSeasonObj.season_number && nextEpisode >= lastSeasonObj.episode_count) {
                            await updateVaultItemStatus(item.id, 'Completed');
                            toast.success(`${item.title} automatically marked as Completed!`);
                        }
                    }
                } catch (e) {
                    console.error("Auto-complete check failed on next episode:", e);
                }
            } else {
                toast.error("Failed to update progress.");
            }
        }
    };


    return (
        <div className="page container">
            <div className="page-header page-header--center">
                <div className="page-heading">
                    <h1 className="page-title">Discover &amp; Vault</h1>
                    <p className="page-subtitle">
                        Search for your favorite movies, TV series, or anime and save them for later.
                    </p>
                </div>
            </div>

            <SearchBar query={currentQuery} setQuery={setCurrentQuery} onSearch={handleSearch} />

            {/* Continue Watching Section */}
            {isTrending && currentUser && getWatchingItems().length > 0 && (
                <div className="section">
                    <div className="section-header">
                        <h2 className="section-title">
                            <Play size={20} /> Continue Watching
                        </h2>
                    </div>
                    <div className="continue-grid">
                        {getWatchingItems()
                            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
                            .slice(0, 6)
                            .map((item) => {
                                const tilePoster = item.poster
                                    ? (item.poster.startsWith("http://") || item.poster.startsWith("https://")
                                        ? item.poster
                                        : `https://image.tmdb.org/t/p/w200${item.poster}`)
                                    : null;

                                return (
                                    <div
                                        key={item.id}
                                        className="continue-card"
                                        onClick={() => setSelectedMedia(item)}
                                    >
                                        {tilePoster ? (
                                            <img
                                                src={tilePoster}
                                                alt={item.title}
                                                className="continue-card__poster"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="continue-card__poster poster-ph">No Poster</div>
                                        )}
                                        <div className="continue-card__body">
                                            <div>
                                                <h3 className="continue-card__title">{item.title}</h3>
                                                <div className="continue-card__type">
                                                    {item.type === 'movie' ? 'Movie' : item.type === 'anime' ? 'Anime' : 'TV Series'}
                                                </div>
                                            </div>
                                            <div className="continue-card__foot">
                                                {item.type !== 'movie' && (
                                                    <div>
                                                        <div className="progress-meta">
                                                            <span>S{item.season || 1} E{item.episode || 0}</span>
                                                            <span>Progress</span>
                                                        </div>
                                                        <div className="progress">
                                                            <div
                                                                className="progress-bar"
                                                                style={{ width: `${Math.min((item.episode || 0) / 12 * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    className="btn btn--sm btn--block"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNextEpisode(item);
                                                    }}
                                                >
                                                    <Play size={14} /> {item.type === 'movie' ? 'Mark Completed' : 'Next Episode'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
                <div className="banner banner--error banner--center">
                    You are currently offline. Search is unavailable, but you can browse your Vault.
                </div>
            )}

            {!isTrending && (
                <div className="load-more-row">
                    <button
                        className="btn btn--outline btn--sm"
                        onClick={() => {
                            setCurrentQuery("");
                            loadTrending();
                        }}
                    >
                        <ArrowLeft size={16} /> Back to Trending
                    </button>
                </div>
            )}

            {isTrending && !loading && !error && (
                <div className="section-header">
                    <h2 className="section-title">
                        {contentType === 'anime' ? 'Trending Anime' :
                         contentType === 'movies' ? 'Trending Movies' :
                         contentType === 'tv' ? 'Trending TV Series' :
                         'Trending This Week'}
                    </h2>
                </div>
            )}

            {!isTrending && !loading && !error && results.length > 0 && (
                <div className="section-header">
                    <h2 className="section-title">Search Results for "{currentQuery}"</h2>
                </div>
            )}

            {loading && page === 1 && (
                <div className="media-grid">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="skeleton-card" />
                    ))}
                </div>
            )}

            {error && <div className="banner banner--error banner--center">{error}</div>}

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
                        <div className="load-more-row">
                            <button className="show-more-btn" onClick={loadMore}>
                                Load More
                            </button>
                        </div>
                    )}
                </>
            )}

            {!loading && !error && results.length === 0 && (
                <div className="state-note">
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
