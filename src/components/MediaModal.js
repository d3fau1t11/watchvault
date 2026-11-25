import { useEffect, useState, useRef } from "react";
import { getMediaDetails, getPersonDetails, getSeasonDetails, getWatchProviders } from "../services/tmdbApi";
import { getAnimeById } from "../services/anilistApi";
import { addToVault, updateVaultItemProgress, removeVaultItem, updateVaultItemStatus, updateVaultItemDetails } from "../services/firestoreService";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { X, Star, Plus, Check, ArrowLeft, Calendar, Trash2, PlayCircle } from "lucide-react";
import YouTube from "react-youtube";
import { STANDARD_CATEGORIES } from "../utils/categories";
import { shouldAutoComplete } from "../utils/autoComplete";
import { normalizeSeries, playableSeasons, playableEpisodes } from '../utils/series';
import { verifySeriesDetails } from '../services/seriesService';
import StarRating from './StarRating';
import WatchStatusControl from './WatchStatusControl';

function MediaModal({ media, onClose }) {
    const [mediaHistory, setMediaHistory] = useState([media]);
    const currentMedia = mediaHistory[mediaHistory.length - 1];
    
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasonEpisodes, setSeasonEpisodes] = useState([]);
    const [episodesLoading, setEpisodesLoading] = useState(false);
    const [episodesError, setEpisodesError] = useState(false);
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [watchProviders, setWatchProviders] = useState(null);
    const modalContentRef = useRef(null);
    const { currentUser } = useAuth();
    const { isInVault, getVaultItem } = useVault();
    const navigate = useNavigate();

    const [myRating, setMyRating] = useState(0);
    const [myReview, setMyReview] = useState("");
    const [myNotes, setMyNotes] = useState("");
    const [myTags, setMyTags] = useState([]);
    const [newTagInput, setNewTagInput] = useState("");
    const [myCategory, setMyCategory] = useState("Uncategorized");
    const [customCategoryInput, setCustomCategoryInput] = useState("");
    const [showTrailerLightbox, setShowTrailerLightbox] = useState(false);

    const currentVaultItem = getVaultItem(currentMedia.tmdbId || currentMedia.id);
    const lastVaultIdRef = useRef(null);

    /* The modal scrolls its own content, so let the page behind it stay put
       instead of scrolling underneath the backdrop. */
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement;
        document.body.style.overflow = "hidden";
        modalContentRef.current?.querySelector('[aria-label="Close"]')?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus?.();
        };
    }, []);

    useEffect(() => {
        const handleKey = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                if (showTrailerLightbox) setShowTrailerLightbox(false);
                else if (showLightbox) setShowLightbox(false);
                else onClose();
            }
            if (event.key === "Tab") {
                const root = showTrailerLightbox || showLightbox ? modalContentRef.current?.querySelector('.lightbox-overlay') : modalContentRef.current;
                const focusable = Array.from(root?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose, showLightbox, showTrailerLightbox]);

    useEffect(() => {
        const vaultId = currentVaultItem ? currentVaultItem.id : null;
        if (lastVaultIdRef.current !== vaultId) {
            if (currentVaultItem) {
                setMyRating(currentVaultItem.rating || 0);
                setMyReview(currentVaultItem.review || "");
                setMyNotes(currentVaultItem.notes || "");
                setMyTags(currentVaultItem.tags || []);
                const itemCat = currentVaultItem.category || "Uncategorized";
                setMyCategory(STANDARD_CATEGORIES.includes(itemCat) ? itemCat : "Custom");
                setCustomCategoryInput(STANDARD_CATEGORIES.includes(itemCat) ? "" : itemCat);
            } else {
                setMyRating(0);
                setMyReview("");
                setMyNotes("");
                setMyTags([]);
                setMyCategory("Uncategorized");
                setCustomCategoryInput("");
            }
            setNewTagInput("");
            lastVaultIdRef.current = vaultId;
        }
    }, [currentMedia, currentVaultItem]);

    const handleSaveCuration = async () => {
        if (!currentVaultItem) return;
        const loadingToast = toast.loading("Updating curation details...");
        const finalCategory = myCategory === "Custom" ? customCategoryInput.trim() : myCategory;
        const res = await updateVaultItemDetails(currentVaultItem.id, {
            rating: myRating,
            review: myReview,
            notes: myNotes,
            tags: myTags,
            category: finalCategory || "Uncategorized"
        });
        if (res.success) {
            toast.success("Curation details saved!", { id: loadingToast });
        } else {
            toast.error("Failed to save details: " + res.error, { id: loadingToast });
        }
    };

    const handleAddTag = (e) => {
        e.preventDefault();
        const cleaned = newTagInput.trim().toLowerCase();
        if (!cleaned) return;
        if (myTags.includes(cleaned)) {
            toast.error("Tag already exists!");
            return;
        }
        setMyTags([...myTags, cleaned]);
        setNewTagInput("");
    };

    const handleRemoveTag = (tagToRemove) => {
        setMyTags(myTags.filter(t => t !== tagToRemove));
    };

    // Reset internal state if the external prop changes
    useEffect(() => {
        setMediaHistory([media]);
    }, [media]);

    useEffect(() => {
        let cancelled = false;
        const fetchDetails = async () => {
            setLoading(true);
            setDetails(null);
            setError(null);
            setIsOverviewExpanded(false);
            setShowLightbox(false);
            setWatchProviders(null);
            
            // Scroll back to top when media changes
            if (modalContentRef.current) {
                modalContentRef.current.scrollTop = 0;
            }

            try {
                if (currentMedia.media_type === 'person' || currentMedia.type === 'person') {
                    const data = await getPersonDetails(currentMedia.id);
                    if (!cancelled) setDetails(data);
                } else if (currentMedia.media_type === 'movie' || currentMedia.media_type === 'tv' || currentMedia.type === 'movie' || currentMedia.type === 'tv' || currentMedia.type === 'anime') {
                    let type = currentMedia.type === 'anime' || currentMedia.media_type === 'anime' ? 'anime' : (currentMedia.media_type || currentMedia.type);
                    if (type === 'anime') {
                        const anilistData = await getAnimeById(currentMedia.tmdbId || currentMedia.id);
                        if (cancelled) return;
                        if (anilistData) {
                            const formattedGenres = anilistData.genres?.map((g, idx) => ({ id: idx, name: g })) || [];
                            const formattedDetails = {
                                id: anilistData.id,
                                name: anilistData.title.english || anilistData.title.romaji,
                                title: anilistData.title.english || anilistData.title.romaji,
                                overview: anilistData.description?.replace(/<[^>]*>/g, '') || "No description available.",
                                poster_path: anilistData.coverImage.large,
                                backdrop_path: anilistData.bannerImage,
                                vote_average: anilistData.averageScore / 10,
                                status: anilistData.status,
                                genres: formattedGenres,
                                number_of_seasons: 1,
                                number_of_episodes: anilistData.episodes || 0,
                                seasons: [
                                    {
                                        season_number: 1,
                                        name: "Season 1",
                                        episode_count: anilistData.episodes || 0
                                    }
                                ],
                                next_episode_to_air: anilistData.nextAiringEpisode ? {
                                    season_number: 1,
                                    episode_number: anilistData.nextAiringEpisode.episode,
                                    name: `Episode ${anilistData.nextAiringEpisode.episode}`,
                                    air_date: new Date(anilistData.nextAiringEpisode.airingAt * 1000).toLocaleDateString()
                                } : null,
                                episodes: anilistData.episodes,
                                streamingEpisodes: anilistData.streamingEpisodes
                            };
                            const validDetails = normalizeSeries(formattedDetails);
                            setDetails(validDetails);
                            setSelectedSeason(validDetails.seasons.length ? 1 : null);
                        } else {
                            throw new Error("Failed to load AniList details");
                        }
                    } else {
                        const rawData = await getMediaDetails(currentMedia.tmdbId || currentMedia.id, type);
                        const data = type === 'tv' ? await verifySeriesDetails(currentMedia, rawData, { strict: false }) : rawData;
                        if (cancelled) return;
                        setDetails(data);
                        
                        // Fetch watch providers
                        const providers = await getWatchProviders(currentMedia.tmdbId || currentMedia.id, type);
                        if (cancelled) return;
                        setWatchProviders(providers);
                        
                        if ((type === 'tv') && data.seasons && data.seasons.length > 0) {
                            const nonZeroSeasons = playableSeasons(data);
                            const defaultSeason = nonZeroSeasons[0]?.season_number ?? null;
                            setSelectedSeason(defaultSeason);
                        } else {
                            setSelectedSeason(null);
                        }
                    }
                }
            } catch (e) {
                if (cancelled) return;
                console.error("Failed to fetch details", e);
                setError("Failed to retrieve details. Please check your internet connection.");
            }
            if (!cancelled) setLoading(false);
        };
        fetchDetails();
        return () => { cancelled = true; };
    }, [currentMedia]);

    useEffect(() => {
        let cancelled = false;
        const fetchSeason = async () => {
            setSeasonEpisodes([]);
            setEpisodesLoading(true);
            setEpisodesError(false);
            try {
            if (selectedSeason !== null && details && (details.id || currentMedia.tmdbId || currentMedia.id)) {
                let type = currentMedia.type === 'anime' || currentMedia.media_type === 'anime' ? 'anime' : (currentMedia.media_type || currentMedia.type);
                if (type === 'anime') {
                    const episodesCount = details.episodes || 0;
                    const mockEpisodes = [];
                    for (let i = 1; i <= episodesCount; i++) {
                        const stream = details.streamingEpisodes?.find(s => s.title.toLowerCase().includes(`episode ${i}`) || s.title.endsWith(` ${i}`));
                        mockEpisodes.push({
                            id: `ep-${i}`,
                            episode_number: i,
                            name: stream ? stream.title.replace(/Episode \d+\s*-\s*/i, '') : `Episode ${i}`,
                            still_path: stream ? stream.thumbnail : null,
                            overview: stream ? `Watch on streaming services. Link: ${stream.url}` : ""
                        });
                    }
                    if (!cancelled) setSeasonEpisodes(mockEpisodes);
                } else {
                    const tvId = details.id || currentMedia.tmdbId || currentMedia.id;
                    const data = await getSeasonDetails(tvId, selectedSeason);
                    if (data && data.episodes) {
                        if (!cancelled) setSeasonEpisodes(playableEpisodes(data.episodes));
                    } else {
                        if (!cancelled) { setSeasonEpisodes([]); setEpisodesError(true); }
                    }
                }
            } else {
                if (!cancelled) setSeasonEpisodes([]);
            }
            } catch { if (!cancelled) { setSeasonEpisodes([]); setEpisodesError(true); } }
            finally { if (!cancelled) setEpisodesLoading(false); }
        };
        fetchSeason();
        return () => { cancelled = true; };
    }, [selectedSeason, details, currentMedia.id, currentMedia.tmdbId, currentMedia.media_type, currentMedia.type]);

    if (!currentMedia) return null;

    const isPerson = currentMedia.media_type === 'person' || currentMedia.type === 'person';

    const title = isPerson ? (details?.name || currentMedia.name) : (details?.title || details?.name || currentMedia.title || currentMedia.name);
    const overview = isPerson ? (details?.biography || "No biography available.") : (details?.overview || currentMedia.overview);
    const year = isPerson ? null : (details?.release_date || details?.first_air_date || currentMedia.release_date || currentMedia.first_air_date || "").substring(0, 4);
    const rating = isPerson ? null : (details?.vote_average ?? currentMedia.vote_average);
    const language = isPerson ? null : (details?.spoken_languages?.[0]?.english_name || currentMedia.original_language?.toUpperCase() || details?.original_language?.toUpperCase());
    const status = isPerson ? null : details?.status;
    const rawBackdrop = details?.backdrop_path || currentMedia.backdrop_path;
    const backdropUrl = isPerson ? null : (rawBackdrop ? (rawBackdrop.startsWith("http://") || rawBackdrop.startsWith("https://") ? rawBackdrop : `https://image.tmdb.org/t/p/w1280${rawBackdrop}`) : null);
    const rawPoster = isPerson ? (details?.profile_path || currentMedia.profile_path) : (details?.poster_path || currentMedia.poster_path || currentMedia.poster);
    const posterUrl = rawPoster ? (rawPoster.startsWith("http://") || rawPoster.startsWith("https://") ? rawPoster : `https://image.tmdb.org/t/p/w500${rawPoster}`) : null;
    
    // Determine the display type
    let rawType = currentMedia.type === 'anime' || currentMedia.media_type === 'anime' ? 'anime' : (currentMedia.media_type || currentMedia.type);
    // Auto-detect if it was a TV show from Japan with Animation genre
    if (!isPerson && details && rawType === 'tv' && details.origin_country?.includes("JP") && details.genres?.some(g => g.id === 16)) {
        rawType = 'anime';
    }
    const isTV = rawType === 'tv' || rawType === 'anime';
    const displayType = isPerson ? details?.known_for_department : (rawType === 'anime' ? 'Anime' : (isTV ? 'TV Series' : 'Movie'));

    // Find a trailer
    const videos = isPerson ? [] : (details?.videos?.results || []);
    const trailer = videos.find(vid => vid.type === "Trailer" && vid.site === "YouTube") || videos.find(vid => vid.site === "YouTube");

    // Get Top Cast & Recommendations
    const cast = isPerson ? [] : (details?.credits?.cast?.slice(0, 10) || []);
    const recommendations = isPerson ? [] : (details?.recommendations?.results?.slice(0, 12) || []);
    
    // Get Actor's known for credits
    const actorCredits = isPerson ? (details?.combined_credits?.cast?.sort((a, b) => b.vote_count - a.vote_count).slice(0, 20) || []) : [];

    const handleRecommendationClick = (rec) => {
        // Carry over the current type so the API knows which endpoint to hit
        // If it's an actor credit, it has a media_type naturally
        const typeToUse = rec.media_type || (rawType === 'anime' ? 'tv' : rawType);
        setMediaHistory([...mediaHistory, { ...rec, media_type: typeToUse }]);
    };

    const handleActorClick = (actor) => {
        setMediaHistory([...mediaHistory, { ...actor, media_type: 'person' }]);
    };

    const handleBack = () => {
        if (mediaHistory.length > 1) {
            setMediaHistory(mediaHistory.slice(0, -1));
        }
    };

    const handleAddRecommendation = async (e, rec) => {
        e.stopPropagation(); // prevent modal from navigating to the movie
        if (!currentUser) {
            navigate("/login");
            return;
        }

        if (isInVault(rec.id)) {
            toast.error(`${rec.title || rec.name} is already in your vault!`);
            return;
        }

        const recTitle = rec.title || rec.name;
        const loadingToast = toast.loading(`Adding ${recTitle}...`);
        
        const typeToUse = rec.media_type || (rawType === 'anime' ? 'tv' : rawType);
        const itemToSave = { ...rec, media_type: typeToUse };
        
        const response = await addToVault(currentUser.uid, itemToSave);
        if (response.success) {
            toast.success(`${recTitle} added to your vault!`, { id: loadingToast });
        } else {
            toast.error("Failed to add to vault.", { id: loadingToast });
        }
    };

    const isCurrentInVault = isInVault(currentMedia.tmdbId || currentMedia.id);

    const handleAddCurrentToVault = async () => {
        if (!currentUser) {
            navigate("/login");
            return;
        }
        if (isCurrentInVault) {
            toast.error("This item is already in your vault!");
            return;
        }
        
        const recTitle = currentMedia.title || currentMedia.name;
        const loadingToast = toast.loading(`Adding ${recTitle}...`);
        
        const typeToUse = rawType === 'anime' ? 'tv' : rawType;
        const itemToSave = { ...currentMedia, media_type: typeToUse };
        
        const response = await addToVault(currentUser.uid, itemToSave);
        if (response.success) {
            toast.success(`${recTitle} added to your vault!`, { id: loadingToast });
        } else {
            toast.error("Failed to add to vault.", { id: loadingToast });
        }
    };

    const handleRemoveCurrentFromVault = async () => {
        const itemId = currentMedia.tmdbId || currentMedia.id;
        const vaultItem = getVaultItem(itemId);
        if (!vaultItem) return;

        const recTitle = currentMedia.title || currentMedia.name;
        const loadingToast = toast.loading(`Removing ${recTitle}...`);

        const response = await removeVaultItem(vaultItem.id);
        if (response.success) {
            toast.success(`${recTitle} removed from your vault!`, { id: loadingToast });
        } else {
            toast.error("Failed to remove from vault.", { id: loadingToast });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} ref={modalContentRef} role="dialog" aria-modal="true" aria-label={title || "Title details"}>
                
                {/* Navigation Buttons */}
                <div className="modal-nav">
                    {mediaHistory.length > 1 ? (
                        <button
                            className="modal-close"
                            onClick={handleBack}
                            title="Go Back"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <div /> /* Empty div to push close button to the right */
                    )}
                    <button
                        className="modal-close"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {backdropUrl && (
                    <div className="modal-header-bg" style={{ backgroundImage: `url(${backdropUrl})` }} />
                )}

                <div className={`modal-body${backdropUrl ? ' modal-body--overlap' : ''}`}>
                    {error ? (
                        <div className="modal-error">
                            <h3 className="modal-error__title">Unable to retrieve details</h3>
                            <p className="modal-error__text">{error}</p>
                        </div>
                    ) : (
                        <>

                    {/* Top Section: Poster & Core Info */}
                    <div className="modal-top-section">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={title}
                                className="modal-poster modal-poster--zoomable"
                                onClick={() => setShowLightbox(true)}
                                role="button"
                                tabIndex={0}
                                aria-label="View full poster"
                                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowLightbox(true); } }}
                                title="Click to view full image"
                            />
                        ) : (
                            <div className="modal-poster poster-ph">No Image</div>
                        )}

                        <div className="modal-info">
                            <h2 className="modal-title">{title}</h2>

                            <div className="modal-meta">
                                {year && <span>{year}</span>}
                                {year && <span className="modal-meta__sep">•</span>}
                                {displayType && <span>{displayType}</span>}

                                {isTV && details?.number_of_seasons && (
                                    <>
                                        <span className="modal-meta__sep">•</span>
                                        <span>{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''} ({details.number_of_episodes} Episodes)</span>
                                    </>
                                )}

                                {status && status !== 'Released' && (
                                    <>
                                        <span className="modal-meta__sep">•</span>
                                        <span className={`modal-meta__status ${
                                            (status === 'Returning Series' || status === 'In Production') ? 'modal-meta__status--live' :
                                            (status === 'Canceled') ? 'modal-meta__status--canceled' : 'modal-meta__status--ended'
                                        }`}>
                                            {status === 'Returning Series' ? 'Currently Airing' : status}
                                        </span>
                                    </>
                                )}

                                {language && (
                                    <>
                                        <span className="modal-meta__sep">•</span>
                                        <span>{language}</span>
                                    </>
                                )}

                                {rating > 0 && (
                                    <>
                                        <span className="modal-meta__sep">•</span>
                                        <span className="modal-meta__rating">
                                            <StarRating value={rating} label="Community rating" />
                                        </span>
                                    </>
                                )}

                                {isPerson && details?.birthday && (
                                    <>
                                        <span className="modal-meta__sep">•</span>
                                        <span>Born: {details.birthday}</span>
                                    </>
                                )}
                            </div>

                            {!isPerson && (
                                <div className="modal-actions">
                                    <button
                                        className={`btn btn--flex${isCurrentInVault ? ' btn--success' : ''}`}
                                        onClick={handleAddCurrentToVault}
                                        disabled={isCurrentInVault}
                                    >
                                        {isCurrentInVault ? <><Check size={18} /> In Your Vault</> : <><Plus size={18} /> Add to Vault</>}
                                    </button>

                                    {trailer && (
                                        <button
                                            className="btn btn--outline btn--flex"
                                            onClick={() => setShowTrailerLightbox(true)}
                                        >
                                            <PlayCircle size={18} /> Watch Trailer
                                        </button>
                                    )}

                                    {isCurrentInVault && (
                                        <button
                                            className="btn btn--danger btn--icon"
                                            onClick={handleRemoveCurrentFromVault}
                                            title="Remove from Vault"
                                            aria-label="Remove from Vault"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {!isPerson && currentUser && isCurrentInVault && currentVaultItem && (
                                <WatchStatusControl key={currentVaultItem.id} item={currentVaultItem} />
                            )}

                            {!isPerson && details?.genres && (
                                <div className="modal-genres">
                                    {details.genres.map(g => (
                                        <span key={g.id} className="pill">
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Watch Providers Section */}
                            {!isPerson && watchProviders && watchProviders.results && watchProviders.results.US && (
                                <div className="providers">
                                    <div className="providers__label">
                                        <PlayCircle size={16} />
                                        <span>Watch on</span>
                                    </div>
                                    <div className="providers__list">
                                        {watchProviders.results.US.flatrate && watchProviders.results.US.flatrate.map((provider, index) => (
                                            <div
                                                key={index}
                                                className="provider"
                                                title={provider.provider_name}
                                            >
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                                <span className="provider__name">{provider.provider_name}</span>
                                            </div>
                                        ))}
                                        {watchProviders.results.US.buy && watchProviders.results.US.buy.map((provider, index) => (
                                            <div
                                                key={`buy-${index}`}
                                                className="provider provider--buy"
                                                title={`Buy on ${provider.provider_name}`}
                                            >
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                                <span className="provider__name">{provider.provider_name} (Buy)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details?.next_episode_to_air && (
                                <div className="next-episode">
                                    <Calendar size={14} />
                                    <span>Next Episode: S{details.next_episode_to_air.season_number}E{details.next_episode_to_air.episode_number} - "{details.next_episode_to_air.name}" ({details.next_episode_to_air.air_date})</span>
                                </div>
                            )}

                            <p className={`modal-overview${isPerson ? ' modal-overview--bio' : ''}`}>
                                {loading ? "Loading details…" : (
                                    <>
                                        {overview && overview.length > 250 && !isOverviewExpanded ? (
                                            <>
                                                {overview.substring(0, 250)}...
                                                <button type="button"
                                                    onClick={() => setIsOverviewExpanded(true)}
                                                    className="modal-overview__toggle"
                                                >
                                                    more
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {overview}
                                                {overview && overview.length > 250 && isOverviewExpanded && (
                                                    <button type="button"
                                                        onClick={() => setIsOverviewExpanded(false)}
                                                        className="modal-overview__toggle"
                                                    >
                                                        less
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Bottom Section: Full Width Details */}
                    <div className="modal-bottom-section">
                        {isTV && !loading && details && playableSeasons(details).length === 0 && <div className="state-note">No episodes are available for this title yet. Empty seasons are excluded from tracking.</div>}
                        {isCurrentInVault && currentVaultItem && (
                            <div className="modal-curation-section">
                                <h3 className="curation-title">
                                    <Star size={18} fill="currentColor" /> My Curation Vault
                                </h3>

                                {/* Rating Row */}
                                <div className="field">
                                    <label className="field-label">
                                        My Personal Rating
                                    </label>
                                    <div className="rating-row">
                                        <StarRating value={myRating} onChange={setMyRating} size={28} label="My personal rating" />
                                        {myRating > 0 && <button type="button" className="btn btn--ghost btn--icon" aria-label="Clear rating" onClick={() => setMyRating(0)}><X size={16} /></button>}
                                    </div>
                                </div>

                                {/* Category Row */}
                                <div className="field">
                                    <label className="field-label">
                                        Category Classification
                                    </label>
                                    <div className="field-row">
                                        <select
                                            className="select"
                                            aria-label="Category classification"
                                            value={myCategory}
                                            onChange={(e) => {
                                                setMyCategory(e.target.value);
                                                if (e.target.value !== "Custom") {
                                                    setCustomCategoryInput("");
                                                }
                                            }}
                                        >
                                            {STANDARD_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                            <option value="Custom">Custom...</option>
                                        </select>

                                        {myCategory === "Custom" && (
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Enter custom category"
                                                aria-label="Custom category"
                                                value={customCategoryInput}
                                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Tags Row */}
                                <div className="field">
                                    <label className="field-label">
                                        Tags / Custom Collections
                                    </label>
                                    <div className="tag-list">
                                        {myTags.map((tag, idx) => (
                                            <span key={idx} className="pill pill--tag pill--removable">
                                                #{tag}
                                                <button
                                                    type="button"
                                                    className="pill__remove"
                                                    onClick={() => handleRemoveTag(tag)}
                                                    aria-label={`Remove tag ${tag}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                        {myTags.length === 0 && (
                                            <span className="tag-empty">
                                                No tags added yet. Add custom tags below.
                                            </span>
                                        )}
                                    </div>

                                    <form onSubmit={handleAddTag} className="tag-form">
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Add custom tag (e.g. favorites)"
                                            aria-label="Add a custom tag"
                                            value={newTagInput}
                                            onChange={(e) => setNewTagInput(e.target.value)}
                                        />
                                        <button type="submit" className="btn btn--sm">
                                            Add
                                        </button>
                                    </form>
                                </div>

                                {/* Private Notes & Review Grid */}
                                <div className="curation-grid">
                                    <div className="field">
                                        <label className="field-label">
                                            Private Notes (e.g. Watch notes)
                                        </label>
                                        <textarea
                                            className="textarea"
                                            aria-label="Private notes"
                                            value={myNotes}
                                            onChange={(e) => setMyNotes(e.target.value)}
                                            placeholder="Enter private notes..."
                                            rows={3}
                                        />
                                    </div>

                                    <div className="field">
                                        <label className="field-label">
                                            My Written Review
                                        </label>
                                        <textarea
                                            className="textarea"
                                            aria-label="Written review"
                                            value={myReview}
                                            onChange={(e) => setMyReview(e.target.value)}
                                            placeholder="Write your review here..."
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <button className="btn" onClick={handleSaveCuration}>
                                    Save Curation Details
                                </button>
                            </div>
                        )}

                        {isTV && details?.seasons && details.seasons.length > 0 && (
                            <div className="modal-episodes-section">
                                <div className="episodes-head">
                                    <h3 className="modal-section-title">Episodes</h3>
                                    <select
                                        className="select"
                                        value={selectedSeason || ""}
                                        onChange={(e) => { setSeasonEpisodes([]); setSelectedSeason(Number(e.target.value)); }}
                                        aria-label="Select season"
                                    >
                                        {playableSeasons(details).map(s => (
                                            <option key={s.season_number} value={s.season_number}>
                                                {s.name || `Season ${s.season_number}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="episode-list">
                                    {seasonEpisodes.length === 0 ? (
                                        <div className="state-note">{episodesLoading ? 'Loading episodes…' : episodesError ? 'Could not load episodes. Please reopen this title to try again.' : 'No episodes available in this season.'}</div>
                                    ) : (
                                        seasonEpisodes.map(ep => {
                                            const currentVaultItem = getVaultItem(currentMedia.tmdbId || currentMedia.id);
                                            
                                            // An episode is considered "watched" if the user is on a later season, 
                                            // or if they are on the same season and the current episode is <= their tracked episode.
                                            let isWatched = false;
                                            if (currentVaultItem && currentVaultItem.season && currentVaultItem.episode !== undefined) {
                                                if (selectedSeason < currentVaultItem.season) {
                                                    isWatched = true;
                                                } else if (selectedSeason === currentVaultItem.season && ep.episode_number <= currentVaultItem.episode) {
                                                    isWatched = true;
                                                }
                                            }

                                            const handleEpisodeClick = async (e) => {
                                                e.stopPropagation();
                                                if (episodesLoading) return;
                                                if (!currentUser) {
                                                    toast.error("Please login to track progress.");
                                                    return;
                                                }
                                                if (!isCurrentInVault || !currentVaultItem) {
                                                    toast.error("Add this show to your vault first!");
                                                    return;
                                                }

                                                const loadingToast = toast.loading("Saving progress...");
                                                const response = await updateVaultItemProgress(currentVaultItem.id, selectedSeason, ep.episode_number);
                                                
                                                if (response.success) {
                                                    toast.success(`Progress saved: S${selectedSeason} E${ep.episode_number}`, { id: loadingToast });
                                                    
                                                    // Auto-complete if all seasons/episodes are watched (regardless of TMDB Ended status)
                                                    if (shouldAutoComplete({ ...currentVaultItem, season: selectedSeason, episode: ep.episode_number }, details)) {
                                                        if (currentVaultItem.status !== 'Completed') {
                                                            await updateVaultItemStatus(currentVaultItem.id, 'Completed');
                                                            toast.success(`${details.name || details.title} automatically marked as Completed!`);
                                                        }
                                                    }
                                                } else {
                                                    toast.error("Failed to save progress.", { id: loadingToast });
                                                }
                                            };

                                            return (
                                                <div
                                                    key={ep.id}
                                                    onClick={handleEpisodeClick}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`Mark episode ${ep.episode_number} watched: ${ep.name}`}
                                                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleEpisodeClick(e); } }}
                                                    className={`episode-card-row${isWatched ? ' episode-card-row--watched' : ''}${(isCurrentInVault && currentVaultItem) ? ' episode-card-row--clickable' : ''}`}
                                                >
                                                    {ep.still_path ? (
                                                        <img
                                                            src={ep.still_path.startsWith("http://") || ep.still_path.startsWith("https://") ? ep.still_path : `https://image.tmdb.org/t/p/w227_and_h127_bestv2${ep.still_path}`}
                                                            alt={ep.name}
                                                            className="episode-still"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="episode-still poster-ph">No Image</div>
                                                    )}
                                                    <div className="episode-body">
                                                        <div className="episode-head">
                                                            <strong className="episode-name">
                                                                {ep.episode_number}. {ep.name}
                                                                {isWatched && <Check size={16} />}
                                                            </strong>
                                                            <span className="episode-runtime">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                                        </div>
                                                        <p className="episode-overview">
                                                            {ep.overview || "No overview available."}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {cast.length > 0 && (
                            <div className="modal-cast-section">
                                <h3 className="modal-section-title">Top Cast</h3>
                                <div className="modal-cast-list">
                                    {cast.map(actor => (
                                        <div 
                                            key={actor.id} 
                                            className="cast-item" 
                                            onClick={() => handleActorClick(actor)}
                                            role="button" tabIndex={0} aria-label={`View ${actor.name}`}
                                            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleActorClick(actor); } }}
                                        >
                                            {actor.profile_path ? (
                                                <img 
                                                    src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} 
                                                    alt={actor.name} 
                                                    className="cast-photo"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="cast-photo-fallback">No Img</div>
                                            )}
                                            <span className="cast-name">{actor.name}</span>
                                            <span className="cast-character">{actor.character}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {trailer && (
                            <div className="modal-trailer-section">
                                <h3 className="modal-section-title">Trailer</h3>
                                <div className="trailer-container">
                                    <YouTube 
                                        videoId={trailer.key} 
                                        opts={{ width: '100%', height: '100%', playerVars: { origin: window.location.origin } }}
                                    />
                                </div>
                            </div>
                        )}

                        {recommendations.length > 0 && (
                            <div className="modal-recommendations-section">
                                <h3 className="modal-section-title">More Like This</h3>
                                <div className="modal-recommendation-list">
                                    {recommendations.map(rec => (
                                        <div 
                                            key={rec.id} 
                                            className="recommendation-card"
                                            onClick={() => handleRecommendationClick(rec)}
                                            role="button" tabIndex={0} aria-label={`Explore ${rec.title || rec.name}`}
                                            onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleRecommendationClick(rec); } }}
                                        >
                                            <div className="recommendation-poster-wrapper">
                                                {rec.poster_path ? (
                                                    <img 
                                                        src={rec.poster_path.startsWith("http://") || rec.poster_path.startsWith("https://") ? rec.poster_path : `https://image.tmdb.org/t/p/w342${rec.poster_path}`} 
                                                        alt={rec.title || rec.name} 
                                                        className="recommendation-poster"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="recommendation-poster-fallback">No Img</div>
                                                )}
                                                <div className="recommendation-overlay">
                                                    {isInVault(rec.id) ? (
                                                        <div className="recommendation-in-vault">
                                                            <Check size={20} />
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            className="recommendation-add-btn" 
                                                            onClick={(e) => handleAddRecommendation(e, rec)}
                                                            title="Add to Vault"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="recommendation-title">{rec.title || rec.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {actorCredits.length > 0 && (
                            <div className="modal-recommendations-section">
                                <h3 className="modal-section-title">Known For</h3>
                                <div className="modal-recommendation-list">
                                    {actorCredits.map(rec => (
                                        <div 
                                            key={`${rec.id}-${rec.media_type}`} 
                                            className="recommendation-card"
                                            onClick={() => handleRecommendationClick(rec)}
                                            role="button" tabIndex={0} aria-label={`Explore ${rec.title || rec.name}`}
                                            onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleRecommendationClick(rec); } }}
                                        >
                                            <div className="recommendation-poster-wrapper">
                                                {rec.poster_path ? (
                                                    <img 
                                                        src={rec.poster_path.startsWith("http://") || rec.poster_path.startsWith("https://") ? rec.poster_path : `https://image.tmdb.org/t/p/w342${rec.poster_path}`} 
                                                        alt={rec.title || rec.name} 
                                                        className="recommendation-poster"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="recommendation-poster-fallback">No Img</div>
                                                )}
                                                <div className="recommendation-overlay">
                                                    {isInVault(rec.id) ? (
                                                        <div className="recommendation-in-vault">
                                                            <Check size={20} />
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            className="recommendation-add-btn" 
                                                            onClick={(e) => handleAddRecommendation(e, rec)}
                                                            title="Add to Vault"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="recommendation-title">{rec.title || rec.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
            </div>

            {showLightbox && (
                <div
                    className="lightbox-overlay"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowLightbox(false);
                    }}
                >
                    <img
                        src={posterUrl ? posterUrl.replace("/w500", "/original") : ""}
                        alt={title}
                        className="lightbox-image"
                    />
                    <button
                        className="lightbox-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowLightbox(false);
                        }}
                        aria-label="Close image"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

            {showTrailerLightbox && trailer && (
                <div
                    className="lightbox-overlay lightbox-overlay--trailer"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowTrailerLightbox(false);
                    }}
                >
                    <div
                        className="lightbox-player"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <YouTube
                            videoId={trailer.key}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1,
                                    origin: window.location.origin
                                }
                            }}
                        />
                        <button
                            className="lightbox-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTrailerLightbox(false);
                            }}
                            aria-label="Close trailer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
);
}

export default MediaModal;
