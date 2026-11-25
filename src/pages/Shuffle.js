import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { addToVault } from "../services/firestoreService";
import { getTrending, discoverMedia } from "../services/tmdbApi";
import { getTrendingAnime, convertAnilistToTmdbFormat } from "../services/anilistApi";
import { Shuffle as ShuffleIcon, Sparkles, Plus, Info, Check, RefreshCw, Library, Compass, AlertCircle } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import ShuffleAnimation from '../components/ShuffleAnimation';
import StarRating from '../components/StarRating';
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

const SOURCE_OPTIONS = [
    { value: "watchlist", label: "My Watchlist", icon: Library },
    { value: "external", label: "Discover New", icon: Compass }
];

const TYPE_OPTIONS = [
    { value: "all", label: "All" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "TV" },
    { value: "anime", label: "Anime" }
];

function Shuffle() {
    const { currentUser } = useAuth();
    const { vaultItems, isInVault, loading: vaultLoading } = useVault();
    const [source, setSource] = useState(currentUser ? "watchlist" : "external"); // watchlist or external
    const [typeFilter, setTypeFilter] = useState("all"); // all, movie, tv, anime
    const [categoryFilter, setCategoryFilter] = useState("all"); // all, or specific string
    const [yearFilter, setYearFilter] = useState("all"); // all, or specific year
    const [excludeWatched, setExcludeWatched] = useState(true); // Exclude completed items

    const [shuffling, setShuffling] = useState(false);
    const [shuffledItem, setShuffledItem] = useState(null);
    const [reelItems, setReelItems] = useState([]);
    const shuffleTimer = useRef(null);
    const shuffleBusy = useRef(false);
    const mounted = useRef(true);
    const finalChoice = useRef(null);
    const navigate = useNavigate();
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; clearTimeout(shuffleTimer.current); };
    }, []);

    const finishShuffle = useCallback(() => {
        if (!mounted.current || !finalChoice.current) return;
        clearTimeout(shuffleTimer.current);
        setShuffledItem(finalChoice.current);
        finalChoice.current = null;
        setShuffling(false);
        shuffleBusy.current = false;
    }, []);
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

    // Available years derived from the user's vault items
    const availableYears = useMemo(() => {
        const years = new Set();
        vaultItems.forEach(item => {
            if (item.year) years.add(item.year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [vaultItems]);

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

    // The exact pool a watchlist shuffle would draw from. Derived here so the
    // count shown to the user and the set actually shuffled can never diverge.
    const watchlistPool = useMemo(() => {
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
        if (yearFilter !== "all") {
            const year = parseInt(yearFilter, 10);
            pool = pool.filter(item => item.year === year);
        }
        if (excludeWatched) {
            pool = pool.filter(item => item.status !== "Completed");
        }

        return pool;
    }, [vaultItems, typeFilter, categoryFilter, yearFilter, excludeWatched]);

    // Anime comes from AniList trending, which has no genre parameter here.
    const genreFilterIgnored = source === "external" && typeFilter === "anime" && categoryFilter !== "all";
    const watchlistEmpty = source === "watchlist" && watchlistPool.length === 0;

    const handleShuffle = async () => {
        if (shuffleBusy.current) return;
        shuffleBusy.current = true;
        setReelItems([]);

        if (source === "watchlist") {
            const pool = watchlistPool;

            if (pool.length === 0) {
                toast.error("No items in your watchlist match the current filters.");
                shuffleBusy.current = false;
                return;
            }

            const chosen = pool[Math.floor(Math.random() * pool.length)];

            // Animate only real candidates from this watchlist.
            runSpinningAnimation(pool, chosen);
        } else {
            // Shuffle from external discover API
            setShuffling(true);
            setShuffledItem(null);

            try {
                let chosen = null;
                const randomPage = Math.floor(Math.random() * 5) + 1; // Random page 1 to 5
                const year = yearFilter !== "all" ? parseInt(yearFilter, 10) : null;

                if (typeFilter === "anime") {
                    const data = await getTrendingAnime(randomPage, 20);
                    if (data && data.media) {
                        const formatted = data.media.map(convertAnilistToTmdbFormat);
                        // Filter out items already in the vault
                        const filtered = formatted.filter(item => !isInVault(item.id));
                        // Client-side year filter for anime (AniList has no year param)
                        const yearFiltered = year ? filtered.filter(item => {
                            const date = item.first_air_date || item.release_date;
                            return date && date.substring(0, 4) === String(year);
                        }) : filtered;
                        const pool = yearFiltered.length > 0 ? yearFiltered : formatted;
                        chosen = pool[Math.floor(Math.random() * pool.length)];
                    }
                } else if (typeFilter === "movie" || typeFilter === "tv") {
                    const isAdult = categoryFilter === "Adult";
                    const genreId = (categoryFilter !== "all" && !isAdult) ?
                        (typeFilter === "movie" ? CATEGORY_TO_GENRE_ID[categoryFilter] : TV_CATEGORY_TO_GENRE_ID[categoryFilter]) :
                        null;

                    const data = await discoverMedia(typeFilter, randomPage, genreId, isAdult, year);
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

                    const data = await discoverMedia(chosenType, randomPage, genreId, isAdult, year);
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
                    shuffleBusy.current = false;
                    return;
                }

                // Run slots animation
                if (mounted.current) runSpinningAnimation(trendingCyclePosters.map(p => ({ poster_path: p })), chosen);

            } catch (err) {
                if (!mounted.current) return;
                console.error("External shuffle error:", err);
                toast.error("Network error while trying to fetch suggestions.");
                setShuffling(false);
                shuffleBusy.current = false;
            }
        }
    };

    const runSpinningAnimation = (spinPool, finalSelected) => {
        setShuffling(true);
        setShuffledItem(null);
        finalChoice.current = finalSelected;
        const pool = spinPool.length ? spinPool : [finalSelected];
        setReelItems([...Array.from({ length: 18 }, () => pool[Math.floor(Math.random() * pool.length)]), finalSelected]);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        clearTimeout(shuffleTimer.current);
        shuffleTimer.current = setTimeout(finishShuffle, reduced ? 0 : 2400);
    };

    const handleAddShuffledToVault = async (item) => {
        if (!currentUser) { navigate('/login', { state: { from: '/shuffle' } }); return; }
        const loadingToast = toast.loading(`Adding "${item.title || item.name}" to Vault...`);
        const status = "Plan to Watch";

        const normalizedMedia = {
            id: item.tmdbId || item.id,
            ...(item.type ? { type: item.type } : {}),
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
        return (
            <div className="page container">
                <div className="state-note">Loading configuration…</div>
            </div>
        );
    }

    const currentPoster = shuffledItem?.poster || shuffledItem?.poster_path;
    const finalPosterUrl = currentPoster
        ? (currentPoster.startsWith("http") ? currentPoster : `https://image.tmdb.org/t/p/w500${currentPoster}`)
        : null;

    const itemInVault = shuffledItem ? (shuffledItem.isAdded || isInVault(shuffledItem.tmdbId || shuffledItem.id)) : false;

    const shuffledTypeLabel = shuffledItem
        ? (shuffledItem.type === 'anime'
            ? 'Anime'
            : (shuffledItem.media_type === 'movie' || shuffledItem.type === 'movie' ? 'Movie' : 'TV Series'))
        : '';

    return (
        <div className="page container shuffle-page">
            <div className="page-header page-header--center">
                <div className="page-heading">
                    <span className="eyebrow">A LITTLE CHANCE. A GREAT WATCH.</span>
                    <h1 className="page-title">
                        <ShuffleIcon size={28} /> Leave it to chance.
                    </h1>
                    <p className="page-subtitle">
                        Pick from your watchlist or discover something new. We’ll take care of the decision.
                    </p>
                </div>
            </div>

            {/* Config Panel */}
            <div className="shuffle-config">
                {/* Source: the primary choice, so it leads */}
                <div className="field">
                    <span className="field-label">Shuffle source</span>
                    <div className="segmented segmented--block" role="group" aria-label="Shuffle source">
                        {SOURCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                className={`segmented-btn${source === value ? ' segmented-btn--active' : ''}`}
                                aria-pressed={source === value}
                                disabled={shuffling || (value === 'watchlist' && !currentUser)}
                                title={value === 'watchlist' && !currentUser ? 'Sign in to shuffle your watchlist' : undefined}
                                onClick={() => {
                                    setSource(value);
                                    setCategoryFilter("all"); // Reset category filter
                                }}
                            >
                                <Icon size={15} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="shuffle-config__grid">
                    <div className="field">
                        <span className="field-label">Media type</span>
                        <div className="segmented segmented--block" role="group" aria-label="Media type">
                            {TYPE_OPTIONS.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`segmented-btn${typeFilter === value ? ' segmented-btn--active' : ''}`}
                                    aria-pressed={typeFilter === value}
                                    disabled={shuffling}
                                    onClick={() => setTypeFilter(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field">
                        <label className="field-label" htmlFor="shuffleCategory">Category / genre</label>
                        <select
                            id="shuffleCategory"
                            disabled={shuffling}
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="select select--lg"
                        >
                            <option value="all">All Categories</option>
                            {categoriesPool.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {availableYears.length > 0 && (
                        <div className="field">
                            <label className="field-label" htmlFor="shuffleYear">Year</label>
                            <select
                                id="shuffleYear"
                                disabled={shuffling}
                                value={yearFilter}
                                onChange={(e) => setYearFilter(e.target.value)}
                                className="select select--lg"
                            >
                                <option value="all">All Years</option>
                                {availableYears.map(year => (
                                    <option key={year} value={String(year)}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {source === "watchlist" && (
                    <div className="checkbox-row shuffle-config__check">
                        <input
                            type="checkbox"
                            disabled={shuffling}
                            className="checkbox"
                            id="excludeWatchedCheckbox"
                            checked={excludeWatched}
                            onChange={(e) => setExcludeWatched(e.target.checked)}
                        />
                        <label className="checkbox-label" htmlFor="excludeWatchedCheckbox">
                            Exclude completed (watched) titles
                        </label>
                    </div>
                )}

                {genreFilterIgnored && (
                    <p className="shuffle-hint">
                        <AlertCircle size={14} />
                        Anime discovery pulls from trending, so the category filter won't narrow these results.
                    </p>
                )}

                {/* Pool size up front, so an empty result is never a surprise */}
                <div className="shuffle-launch">
                    <span className={`shuffle-pool${watchlistEmpty ? ' shuffle-pool--empty' : ''}`}>
                        {source === "watchlist"
                            ? (watchlistPool.length === 1
                                ? "1 title matches these filters"
                                : `${watchlistPool.length} titles match these filters`)
                            : "Drawing from trending & discover"}
                    </span>

                    <button
                        onClick={handleShuffle}
                        className="btn btn--lg btn--block"
                        disabled={shuffling || watchlistEmpty}
                    >
                        {shuffling ? (
                            <>
                                <RefreshCw size={18} className="spinner-icon" />
                                Shuffling the deck…
                            </>
                        ) : (
                            <>
                                <ShuffleIcon size={18} />
                                Shuffle Titles
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Shuffle Screen / Results */}
            <div className="shuffle-stage">
                {shuffling && (
                    <ShuffleAnimation items={reelItems} source={source} onFinish={finishShuffle} />
                )}

                {!shuffling && shuffledItem && (
                    <div className="shuffle-result-card">
                        {finalPosterUrl ? (
                            <img
                                src={finalPosterUrl}
                                alt={shuffledItem.title || shuffledItem.name}
                                className="shuffle-result-card__poster"
                            />
                        ) : (
                            <div className="shuffle-result-card__poster poster-ph">No Poster</div>
                        )}
                        <div className="shuffle-result-card__body">
                            <div>
                                <div className="shuffle-result-card__badges">
                                    <span className="pill pill--accent pill--uppercase">
                                        {shuffledTypeLabel}
                                    </span>
                                    {shuffledItem.category && (
                                        <span className="pill pill--category">{shuffledItem.category}</span>
                                    )}
                                    {shuffledItem.vote_average > 0 && (
                                        <span className="pill pill--star">
                                            <StarRating value={shuffledItem.vote_average} label="Community rating" />
                                        </span>
                                    )}
                                </div>
                                <h2 className="shuffle-result-card__title">
                                    {shuffledItem.title || shuffledItem.name}
                                </h2>
                                <p className="shuffle-result-card__overview">
                                    {shuffledItem.overview || "No overview available for this title."}
                                </p>
                            </div>

                            <div className="shuffle-result-card__actions">
                                <button
                                    className="btn btn--outline btn--flex"
                                    onClick={() => setSelectedMedia(shuffledItem)}
                                >
                                    <Info size={16} /> View Details
                                </button>

                                {source === "external" && (
                                    <button
                                        className={`btn btn--flex${itemInVault ? ' btn--success' : ''}`}
                                        onClick={() => handleAddShuffledToVault(shuffledItem)}
                                        disabled={itemInVault}
                                    >
                                        {itemInVault ? (
                                            <><Check size={16} /> In Your Vault</>
                                        ) : (
                                            <><Plus size={16} /> Add to Vault</>
                                        )}
                                    </button>
                                )}

                                {/* Re-roll without scrolling back to the panel */}
                                <button
                                    className="btn btn--ghost btn--icon"
                                    onClick={handleShuffle}
                                    disabled={shuffling || watchlistEmpty}
                                    title="Shuffle again"
                                    aria-label="Shuffle again"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!shuffling && !shuffledItem && (
                    <div className="empty empty--dashed shuffle-standby">
                        <Sparkles size={44} className="empty-icon" />
                        <h3 className="empty-title">Shuffler standby</h3>
                        <p className="empty-text">
                            Adjust the filters above and hit shuffle to pick a random title.
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
