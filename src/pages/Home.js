import { useState, useEffect, useCallback, lazy, Suspense, useMemo, useRef } from "react";
import { searchMedia, getTrending } from "../services/tmdbApi";
import { getSeriesDetails, getNextSeriesProgress } from "../services/seriesService";
import { normalizeProgress } from "../utils/series";
import { searchAnime, getTrendingAnime, convertAnilistToTmdbFormat } from "../services/anilistApi";
import { addToVault, updateVaultItemProgress, updateVaultItemStatus } from "../services/firestoreService";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import SearchBar from "../components/SearchBar";
import MediaCard from "../components/MediaCard";
import FilterTabs from "../components/FilterTabs";
import { ArrowRight, ArrowUpRight, Compass, Play, RefreshCw } from "lucide-react";
import FeaturedDiscovery from "../components/FeaturedDiscovery";
import { shouldAutoComplete } from "../utils/autoComplete";

const MediaModal = lazy(() => import("../components/MediaModal"));

function Home() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [currentQuery, setCurrentQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const requestRef = useRef(0);
    const location = useLocation();
    const [hasMore, setHasMore] = useState(true);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [isTrending, setIsTrending] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { isInVault, getWatchingItems } = useVault();
    const [contentType, setContentType] = useState("all"); // all, movies, tv, anime
    const [yearFilter, setYearFilter] = useState("all");

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
        const request = ++requestRef.current;
        setLoading(true);
        setError(null);
        setIsTrending(!activeQuery);
        setPage(1);
        setLoadingMore(false);
        try {
            if (contentType === "anime") {
                const data = activeQuery ? await searchAnime(activeQuery, 1, 20) : await getTrendingAnime(1, 20);
                if (request !== requestRef.current) return;
                const convertedData = data.media.map(convertAnilistToTmdbFormat);
                setResults(convertedData);
                setPage(1);
                setHasMore(data.pageInfo.hasNextPage);
            } else {
                const type = contentType === "movies" ? "movie" : contentType === "tv" ? "tv" : "all";
                const data = activeQuery ? await searchMedia(activeQuery, 1, type) : await getTrending(1, type);
                if (request !== requestRef.current) return;
                setResults(data.results);
                setPage(1);
                setHasMore(data.page < data.total_pages);
            }
        } catch (err) {
            if (request === requestRef.current) setError("We couldn’t load these titles. Please try again.");
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, [contentType, activeQuery]);

    useEffect(() => {
        loadTrending();
        return () => { requestRef.current += 1; };
    }, [loadTrending, reloadKey]);

    useEffect(() => {
        if (location.hash === "#discover-search") {
            document.getElementById("discover-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
            document.getElementById("media-search")?.focus({ preventScroll: true });
        }
    }, [location.hash]);

    const handleSearch = (query) => {
        setCurrentQuery(query);
        setActiveQuery(query.trim());
        setYearFilter("all");
        setReloadKey(key => key + 1);
    };

    const loadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        const request = requestRef.current;
        const nextPage = page + 1;
        try {
            let newData;
            if (contentType === "anime") {
                if (isTrending) {
                    newData = await getTrendingAnime(nextPage, 20);
                } else {
                    newData = await searchAnime(activeQuery, nextPage, 20);
                }
                if (request !== requestRef.current) return;
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
                    data = await searchMedia(activeQuery, nextPage, type);
                }
                if (request !== requestRef.current) return;
                setResults([...results, ...data.results]);
                setPage(nextPage);
                setHasMore(data.page < data.total_pages);
            }
        } catch (err) {
            toast.error("Failed to load more results.");
        } finally {
            if (request === requestRef.current) setLoadingMore(false);
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
            try {
            const details = await getSeriesDetails(item);
            const next = await getNextSeriesProgress({ ...item, ...normalizeProgress(item, details) }, details);
            if (!next) {
                if (shouldAutoComplete(item, details)) await updateVaultItemStatus(item.id, 'Completed');
                else toast.error('No episodes are available for this title.');
                return;
            }
            const response = await updateVaultItemProgress(item.id, next.season, next.episode);
            if (response.success) {
                toast.success(`Progress updated to S${next.season} E${next.episode}`);

                // Auto-complete if all seasons/episodes are watched (regardless of TMDB Ended status)
                try {
                    if (shouldAutoComplete({ ...item, ...next }, details)) {
                        await updateVaultItemStatus(item.id, 'Completed');
                        toast.success(`${item.title} automatically marked as Completed!`);
                    }
                } catch (e) {
                    console.error("Auto-complete check failed on next episode:", e);
                }
            } else {
                toast.error("Failed to update progress.");
            }
            } catch (error) { toast.error('Could not load episodes. Your progress has not changed.'); }
        }
    };

    // Available years from current search/trending results for the year filter
    const availableYears = useMemo(() => {
        const years = new Set();
        results.forEach(item => {
            const date = item.release_date || item.first_air_date;
            if (date && typeof date === "string") {
                const year = date.substring(0, 4);
                if (/^\d{4}$/.test(year)) years.add(parseInt(year, 10));
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [results]);

    return (
        <div className="page container discovery-page">
            <div className="page-header discovery-heading">
                <div className="page-heading">
                    <span className="eyebrow">A WORLD OF STORIES</span>
                    <h1 className="page-title">Your next great watch<span className="accent-text">.</span></h1>
                    <p className="page-subtitle">Discover something worth your time. Keep everything you love.</p>
                </div>
                <Link className="text-link" to={currentUser ? "/vault" : "/login"}>Open my vault <ArrowUpRight size={16} /></Link>
            </div>

            {isTrending && !loading && !error && <FeaturedDiscovery items={results} onSelect={setSelectedMedia} onAdd={handleAddToVault} />}

            <div className="discovery-search-panel" id="discover-search">
                <SearchBar query={currentQuery} setQuery={setCurrentQuery} onSearch={handleSearch} contentType={contentType} />
                <FilterTabs options={[
                    { value: 'all', label: 'Everything' }, { value: 'movies', label: 'Movies' },
                    { value: 'tv', label: 'TV series' }, { value: 'anime', label: 'Anime' }
                ]} activeOption={contentType} onChange={(value) => { setContentType(value); setYearFilter("all"); }} />
            </div>

            {/* Continue Watching Section */}
            {isTrending && currentUser && getWatchingItems().length > 0 && (
                <div className="section">
                    <div className="section-header">
                        <h2 className="section-title">
                            <Play size={20} /> Continue Watching
                        </h2>
                        <Link className="text-link" to="/vault">View all <ArrowRight size={15} /></Link>
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
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Continue ${item.title}`}
                                        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedMedia(item); } }}
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
                                                            <span>{item.hasEpisodes === false ? 'No episodes available' : `S${item.season || 1} E${item.episode || 0}`}</span>
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
                                                    disabled={item.hasEpisodes === false}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNextEpisode(item);
                                                    }}
                                                >
                                                    <Play size={14} /> {item.hasEpisodes === false ? 'No episodes available' : item.type === 'movie' ? 'Mark Completed' : 'Next Episode'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Year Filter */}
            {availableYears.length > 0 && !isTrending && (
                <div className="year-filter">
                    <label className="year-filter__label">Filter by Year</label>
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

            {!isOnline && (
                <div className="banner banner--error banner--center">
                    You are currently offline. Search is unavailable, but you can browse your Vault.
                </div>
            )}

            {isTrending && !loading && !error && (
                <div className="section-header">
                    <h2 className="section-title">
                        <Compass size={20} />
                        {contentType === 'anime' ? 'Trending Anime' :
                         contentType === 'movies' ? 'Trending Movies' :
                         contentType === 'tv' ? 'Trending TV Series' :
                         'Trending This Week'}
                    </h2>
                    <span className="section-meta">The stories everyone’s talking about</span>
                </div>
            )}

            {!isTrending && !loading && !error && results.length > 0 && (
                <div className="section-header">
                    <h2 className="section-title">Results for “{activeQuery}”</h2>
                    <button className="text-link" onClick={() => handleSearch("")}>Back to trending <ArrowRight size={15} /></button>
                </div>
            )}

            {loading && page === 1 && (
                <div className="media-grid">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="skeleton-card" />
                    ))}
                </div>
            )}

            {error && <div className="banner banner--error banner--center" role="alert">{error}<button className="btn btn--outline btn--sm" onClick={() => setReloadKey(key => key + 1)}><RefreshCw size={15} />Try again</button></div>}

            {!loading && !error && results.length > 0 && (
                <>
                    <div className="media-grid">
                        {results
                            .filter(item => {
                                if (yearFilter === "all") return true;
                                const date = item.release_date || item.first_air_date;
                                if (!date || typeof date !== "string") return false;
                                const year = date.substring(0, 4);
                                return year === yearFilter;
                            })
                            .map((item, index) => (
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
                            <button className="show-more-btn" onClick={loadMore} disabled={loadingMore}>
                                {loadingMore ? "Loading titles…" : "Discover more"} <ArrowRight size={16} />
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

            {!loading && !error && results.length > 0 && yearFilter !== "all" && !results.some(item => (item.release_date || item.first_air_date || "").slice(0, 4) === yearFilter) && <div className="state-note">No titles from {yearFilter} on these pages. Try another year or load more titles.</div>}

            <footer className="page-footer"><span><span className="accent-text">watchvault</span> · A home for your next obsession.</span><span>Movies. Series. Anime.</span></footer>

            {selectedMedia && (
                <Suspense fallback={null}>
                    <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
                </Suspense>
            )}
        </div>
    );
}

export default Home;
