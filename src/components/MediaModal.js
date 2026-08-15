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

function MediaModal({ media, onClose }) {
    const [mediaHistory, setMediaHistory] = useState([media]);
    const currentMedia = mediaHistory[mediaHistory.length - 1];
    
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasonEpisodes, setSeasonEpisodes] = useState([]);
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
    const [showTrailerLightbox, setShowTrailerLightbox] = useState(false);

    const currentVaultItem = getVaultItem(currentMedia.tmdbId || currentMedia.id);
    const lastVaultIdRef = useRef(null);

    useEffect(() => {
        const vaultId = currentVaultItem ? currentVaultItem.id : null;
        if (lastVaultIdRef.current !== vaultId) {
            if (currentVaultItem) {
                setMyRating(currentVaultItem.rating || 0);
                setMyReview(currentVaultItem.review || "");
                setMyNotes(currentVaultItem.notes || "");
                setMyTags(currentVaultItem.tags || []);
            } else {
                setMyRating(0);
                setMyReview("");
                setMyNotes("");
                setMyTags([]);
            }
            setNewTagInput("");
            lastVaultIdRef.current = vaultId;
        }
    }, [currentMedia, currentVaultItem]);

    const handleSaveCuration = async () => {
        if (!currentVaultItem) return;
        const loadingToast = toast.loading("Updating curation details...");
        const res = await updateVaultItemDetails(currentVaultItem.id, {
            rating: myRating,
            review: myReview,
            notes: myNotes,
            tags: myTags
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
                    setDetails(data);
                } else if (currentMedia.media_type === 'movie' || currentMedia.media_type === 'tv' || currentMedia.type === 'movie' || currentMedia.type === 'tv' || currentMedia.type === 'anime') {
                    let type = currentMedia.type === 'anime' || currentMedia.media_type === 'anime' ? 'anime' : (currentMedia.media_type || currentMedia.type);
                    if (type === 'anime') {
                        const anilistData = await getAnimeById(currentMedia.tmdbId || currentMedia.id);
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
                                number_of_episodes: anilistData.episodes || 12,
                                seasons: [
                                    {
                                        season_number: 1,
                                        name: "Season 1",
                                        episode_count: anilistData.episodes || 12
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
                            setDetails(formattedDetails);
                            setSelectedSeason(1);
                        } else {
                            throw new Error("Failed to load AniList details");
                        }
                    } else {
                        const data = await getMediaDetails(currentMedia.tmdbId || currentMedia.id, type);
                        setDetails(data);
                        
                        // Fetch watch providers
                        const providers = await getWatchProviders(currentMedia.tmdbId || currentMedia.id, type);
                        setWatchProviders(providers);
                        
                        if ((type === 'tv') && data.seasons && data.seasons.length > 0) {
                            const nonZeroSeasons = data.seasons.filter(s => s.season_number > 0);
                            const defaultSeason = nonZeroSeasons.length > 0 ? nonZeroSeasons[0].season_number : data.seasons[0].season_number;
                            setSelectedSeason(defaultSeason);
                        } else {
                            setSelectedSeason(null);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch details", e);
                setError("Failed to retrieve details. Please check your internet connection.");
            }
            setLoading(false);
        };
        fetchDetails();
    }, [currentMedia]);

    useEffect(() => {
        const fetchSeason = async () => {
            if (selectedSeason !== null && details && (details.id || currentMedia.tmdbId || currentMedia.id)) {
                let type = currentMedia.type === 'anime' || currentMedia.media_type === 'anime' ? 'anime' : (currentMedia.media_type || currentMedia.type);
                if (type === 'anime') {
                    const episodesCount = details.episodes || 12;
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
                    setSeasonEpisodes(mockEpisodes);
                } else {
                    const tvId = details.id || currentMedia.tmdbId || currentMedia.id;
                    const data = await getSeasonDetails(tvId, selectedSeason);
                    if (data && data.episodes) {
                        setSeasonEpisodes(data.episodes);
                    } else {
                        setSeasonEpisodes([]);
                    }
                }
            } else {
                setSeasonEpisodes([]);
            }
        };
        fetchSeason();
    }, [selectedSeason, details, currentMedia.id, currentMedia.tmdbId, currentMedia.media_type, currentMedia.type]);

    if (!currentMedia) return null;

    const isPerson = currentMedia.media_type === 'person' || currentMedia.type === 'person';

    const title = isPerson ? (details?.name || currentMedia.name) : (details?.title || details?.name || currentMedia.title || currentMedia.name);
    const overview = isPerson ? (details?.biography || "No biography available.") : (details?.overview || currentMedia.overview);
    const year = isPerson ? null : (details?.release_date || details?.first_air_date || currentMedia.release_date || currentMedia.first_air_date || "").substring(0, 4);
    const rating = isPerson ? null : (details?.vote_average?.toFixed(1) || currentMedia.vote_average?.toFixed(1));
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
            <div className="modal-content" onClick={e => e.stopPropagation()} ref={modalContentRef}>
                
                {/* Navigation Buttons */}
                <div style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', display: 'flex', justifyContent: 'space-between', zIndex: 20 }}>
                    {mediaHistory.length > 1 ? (
                        <button 
                            className="modal-close" 
                            onClick={handleBack} 
                            style={{ position: 'relative', top: '0', right: '0' }}
                            title="Go Back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <div /> /* Empty div to push close button to the right */
                    )}
                    <button 
                        className="modal-close" 
                        onClick={onClose}
                        style={{ position: 'relative', top: '0', right: '0' }}
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {backdropUrl && (
                    <div className="modal-header-bg" style={{ backgroundImage: `url(${backdropUrl})` }} />
                )}

                <div className="modal-body" style={{ marginTop: backdropUrl ? '-100px' : '0' }}>
                    {error ? (
                        <div style={{
                            padding: '60px 20px',
                            textAlign: 'center',
                            color: '#f87171'
                        }}>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Unable to retrieve details</h3>
                            <p style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{error}</p>
                        </div>
                    ) : (
                        <>
                    
                    {/* Top Section: Poster & Core Info */}
                    <div className="modal-top-section">
                        {posterUrl ? (
                            <img 
                                src={posterUrl} 
                                alt={title} 
                                className="modal-poster" 
                                style={{
                                    ...(isPerson ? { height: '300px', objectFit: 'cover' } : {}),
                                    cursor: 'zoom-in'
                                }} 
                                onClick={() => setShowLightbox(true)}
                                title="Click to view full image"
                            />
                        ) : (
                            <div className="modal-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1d24' }}>
                                <span style={{ color: '#94a3b8' }}>No Image</span>
                            </div>
                        )}
                        
                        <div className="modal-info">
                            <h2 className="modal-title">{title}</h2>
                            
                            <div className="modal-meta">
                                {year && <span>{year}</span>}
                                {year && <span>•</span>}
                                {displayType && <span style={{ textTransform: 'capitalize' }}>{displayType}</span>}
                                
                                {isTV && details?.number_of_seasons && (
                                    <>
                                        <span>•</span>
                                        <span>{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''} ({details.number_of_episodes} Episodes)</span>
                                    </>
                                )}

                                {status && status !== 'Released' && (
                                    <>
                                        <span>•</span>
                                        <span style={{ 
                                            color: (status === 'Returning Series' || status === 'In Production') ? '#34d399' : 
                                                   (status === 'Canceled') ? '#ef4444' : '#94a3b8',
                                            fontWeight: '500'
                                        }}>
                                            {status === 'Returning Series' ? 'Currently Airing' : status}
                                        </span>
                                    </>
                                )}

                                {language && (
                                    <>
                                        <span>•</span>
                                        <span>{language}</span>
                                    </>
                                )}

                                {rating > 0 && (
                                    <>
                                        <span>•</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
                                            <Star size={14} fill="currentColor" /> {rating}
                                        </span>
                                    </>
                                )}

                                {isPerson && details?.birthday && (
                                    <>
                                        <span>•</span>
                                        <span>Born: {details.birthday}</span>
                                    </>
                                )}
                            </div>

                            {!isPerson && (
                                <div style={{ marginBottom: '20px', maxWidth: '400px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button 
                                        className="btn"
                                        onClick={handleAddCurrentToVault}
                                        style={{ 
                                            flex: 1, 
                                            display: 'flex', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            gap: '8px',
                                            background: isCurrentInVault ? '#22c55e' : 'var(--accent-primary)',
                                            borderColor: isCurrentInVault ? '#22c55e' : 'var(--accent-primary)',
                                            color: 'white',
                                            cursor: isCurrentInVault ? 'default' : 'pointer',
                                            padding: '12px'
                                        }}
                                        disabled={isCurrentInVault}
                                    >
                                        {isCurrentInVault ? <><Check size={18} /> In Your Vault</> : <><Plus size={18} /> Add to Vault</>}
                                    </button>

                                    {trailer && (
                                        <button 
                                            className="btn btn-outline"
                                            onClick={() => setShowTrailerLightbox(true)}
                                            style={{ 
                                                flex: 1, 
                                                display: 'flex', 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                gap: '8px',
                                                borderColor: 'var(--accent-primary)',
                                                color: 'var(--text-primary)',
                                                padding: '12px'
                                            }}
                                        >
                                            <PlayCircle size={18} /> Watch Trailer
                                        </button>
                                    )}
                                    
                                    {isCurrentInVault && (
                                        <button 
                                            className="btn"
                                            onClick={handleRemoveCurrentFromVault}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                padding: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Remove from Vault"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {!isPerson && details?.genres && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                    {details.genres.map(g => (
                                        <span key={g.id} style={{ background: 'rgba(229, 9, 20, 0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#f8fafc' }}>
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Watch Providers Section */}
                            {!isPerson && watchProviders && watchProviders.results && watchProviders.results.US && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <PlayCircle size={16} />
                                        <span>Watch on</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {watchProviders.results.US.flatrate && watchProviders.results.US.flatrate.map((provider, index) => (
                                            <div 
                                                key={index}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                                }}
                                                title={provider.provider_name}
                                            >
                                                <img 
                                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} 
                                                    alt={provider.provider_name}
                                                    style={{ width: '32px', height: '32px', borderRadius: '4px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{provider.provider_name}</span>
                                            </div>
                                        ))}
                                        {watchProviders.results.US.buy && watchProviders.results.US.buy.map((provider, index) => (
                                            <div 
                                                key={`buy-${index}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    opacity: 0.7
                                                }}
                                                title={`Buy on ${provider.provider_name}`}
                                            >
                                                <img 
                                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} 
                                                    alt={provider.provider_name}
                                                    style={{ width: '32px', height: '32px', borderRadius: '4px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{provider.provider_name} (Buy)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details?.next_episode_to_air && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.82rem',
                                    color: '#34d399',
                                    marginTop: '8px',
                                    marginBottom: '20px',
                                    fontWeight: '600',
                                    background: 'rgba(52, 211, 153, 0.1)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    width: 'fit-content',
                                    border: '1px solid rgba(52, 211, 153, 0.2)'
                                }}>
                                    <Calendar size={14} />
                                    <span>Next Episode: S{details.next_episode_to_air.season_number}E{details.next_episode_to_air.episode_number} - "{details.next_episode_to_air.name}" ({details.next_episode_to_air.air_date})</span>
                                </div>
                            )}

                            <p className="modal-overview" style={isPerson ? { whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' } : {}}>
                                {loading ? "Loading details..." : (
                                    <>
                                        {overview && overview.length > 250 && !isOverviewExpanded ? (
                                            <>
                                                {overview.substring(0, 250)}...
                                                <span 
                                                    onClick={() => setIsOverviewExpanded(true)}
                                                    style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer', marginLeft: '6px' }}
                                                >
                                                    more
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                {overview}
                                                {overview && overview.length > 250 && isOverviewExpanded && (
                                                    <span 
                                                        onClick={() => setIsOverviewExpanded(false)}
                                                        style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer', marginLeft: '6px' }}
                                                    >
                                                        less
                                                    </span>
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
                        {isCurrentInVault && currentVaultItem && (
                            <div className="modal-curation-section" style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(229, 9, 20, 0.2)',
                                borderRadius: '12px',
                                padding: '24px',
                                marginBottom: '24px',
                                boxShadow: 'var(--shadow-lg)'
                            }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--accent-primary)' }}>★</span> My Curation Vault
                                </h3>
                                
                                {/* Rating Row */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                                        My Personal Rating
                                    </label>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => (
                                            <Star 
                                                key={starValue} 
                                                size={22} 
                                                fill={starValue <= myRating ? "#fbbf24" : "transparent"} 
                                                color={starValue <= myRating ? "#fbbf24" : "#475569"} 
                                                style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                                                onClick={() => setMyRating(starValue)}
                                            />
                                        ))}
                                        {myRating > 0 && (
                                            <span style={{ marginLeft: '12px', fontSize: '1rem', color: '#fbbf24', fontWeight: 700 }}>
                                                {myRating}/10
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Tags Row */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                                        Tags / Custom Collections
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        {myTags.map((tag, idx) => (
                                            <span key={idx} style={{ 
                                                background: 'rgba(229, 9, 20, 0.1)', 
                                                border: '1px solid rgba(229, 9, 20, 0.2)', 
                                                padding: '4px 10px', 
                                                borderRadius: '20px', 
                                                fontSize: '0.8rem', 
                                                color: 'var(--text-primary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                #{tag}
                                                <button 
                                                    onClick={() => handleRemoveTag(tag)}
                                                    style={{ 
                                                        background: 'transparent', 
                                                        border: 'none', 
                                                        color: '#f87171', 
                                                        cursor: 'pointer', 
                                                        padding: 0, 
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                        {myTags.length === 0 && (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                No tags added yet. Add custom tags below.
                                            </span>
                                        )}
                                    </div>
                                    
                                    <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '8px', maxWidth: '300px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="Add custom tag (e.g. favorites)" 
                                            value={newTagInput}
                                            onChange={(e) => setNewTagInput(e.target.value)}
                                            style={{
                                                flex: 1,
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                        <button 
                                            type="submit" 
                                            className="btn" 
                                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                        >
                                            Add
                                        </button>
                                    </form>
                                </div>

                                {/* Private Notes & Review Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                                            Private Notes (e.g. Watch notes)
                                        </label>
                                        <textarea 
                                            value={myNotes}
                                            onChange={(e) => setMyNotes(e.target.value)}
                                            placeholder="Enter private notes..."
                                            rows={3}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                resize: 'vertical',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>
                                    
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                                            My Written Review
                                        </label>
                                        <textarea 
                                            value={myReview}
                                            onChange={(e) => setMyReview(e.target.value)}
                                            placeholder="Write your review here..."
                                            rows={3}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                resize: 'vertical',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>
                                </div>

                                <button 
                                    className="btn" 
                                    onClick={handleSaveCuration}
                                    style={{ fontSize: '0.9rem', padding: '10px 16px' }}
                                >
                                    Save Curation Details
                                </button>
                            </div>
                        )}

                        {isTV && details?.seasons && details.seasons.length > 0 && (
                            <div className="modal-episodes-section" style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Episodes</h3>
                                    <select 
                                        value={selectedSeason || ""} 
                                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                        style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px', outline: 'none' }}
                                    >
                                        {details.seasons.filter(s => s.season_number > 0).map(s => (
                                            <option key={s.season_number} value={s.season_number} style={{ background: '#1a1d24' }}>
                                                {s.name || `Season ${s.season_number}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px', scrollbarWidth: 'thin', scrollbarColor: 'var(--accent-primary) transparent' }}>
                                    {seasonEpisodes.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)' }}>Loading episodes...</div>
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
                                                    
                                                    // Auto-complete if show is ended/canceled and all episodes are watched
                                                    const isEndedOrCanceled = details?.status === 'Ended' || details?.status === 'Canceled';
                                                    const nonZeroSeasons = details?.seasons?.filter(s => s.season_number > 0) || [];
                                                    const lastSeasonObj = nonZeroSeasons[nonZeroSeasons.length - 1];
                                                    
                                                    if (isEndedOrCanceled && lastSeasonObj && currentVaultItem) {
                                                        if (selectedSeason === lastSeasonObj.season_number && ep.episode_number >= lastSeasonObj.episode_count) {
                                                            if (currentVaultItem.status !== 'Completed') {
                                                                await updateVaultItemStatus(currentVaultItem.id, 'Completed');
                                                                toast.success(`${details.name || details.title} automatically marked as Completed!`);
                                                            }
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
                                                    className="episode-card-row"
                                                    style={{ 
                                                        display: 'flex', gap: '16px', 
                                                        background: isWatched ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)', 
                                                        padding: '12px', borderRadius: '8px', 
                                                        border: isWatched ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                        cursor: (isCurrentInVault && currentVaultItem) ? 'pointer' : 'default',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {ep.still_path ? (
                                                        <img src={ep.still_path.startsWith("http://") || ep.still_path.startsWith("https://") ? ep.still_path : `https://image.tmdb.org/t/p/w227_and_h127_bestv2${ep.still_path}`} alt={ep.name} style={{ width: '130px', height: '73px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, opacity: isWatched ? 0.6 : 1 }} loading="lazy" />
                                                    ) : (
                                                        <div style={{ width: '130px', height: '73px', background: '#1a1d24', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', flexShrink: 0, opacity: isWatched ? 0.6 : 1 }}>No Image</div>
                                                    )}
                                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, opacity: isWatched ? 0.7 : 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <strong style={{ fontSize: '1rem', color: isWatched ? '#4ade80' : 'white' }}>
                                                                {ep.episode_number}. {ep.name}
                                                                {isWatched && <Check size={16} style={{display: 'inline-block', marginLeft: '6px', verticalAlign: 'text-bottom'}} />}
                                                            </strong>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                                        </div>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Top Cast</h3>
                                <div className="modal-cast-list">
                                    {cast.map(actor => (
                                        <div 
                                            key={actor.id} 
                                            className="cast-item" 
                                            onClick={() => handleActorClick(actor)}
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
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Trailer</h3>
                                <div className="trailer-container">
                                    <YouTube 
                                        videoId={trailer.key} 
                                        opts={{ width: '100%', height: '100%', playerVars: { origin: 'http://localhost:3000' } }} 
                                    />
                                </div>
                            </div>
                        )}

                        {recommendations.length > 0 && (
                            <div className="modal-recommendations-section">
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>More Like This</h3>
                                <div className="modal-recommendation-list">
                                    {recommendations.map(rec => (
                                        <div 
                                            key={rec.id} 
                                            className="recommendation-card"
                                            onClick={() => handleRecommendationClick(rec)}
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
                                                        <div style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Known For</h3>
                                <div className="modal-recommendation-list">
                                    {actorCredits.map(rec => (
                                        <div 
                                            key={`${rec.id}-${rec.media_type}`} 
                                            className="recommendation-card"
                                            onClick={() => handleRecommendationClick(rec)}
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
                                                        <div style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0, 0, 0, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        cursor: 'zoom-out'
                    }}
                >
                    <img 
                        src={posterUrl ? posterUrl.replace("/w500", "/original") : ""} 
                        alt={title} 
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                            animation: 'zoomIn 0.2s ease'
                        }}
                    />
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowLightbox(false);
                        }}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            padding: '12px 16px',
                            borderRadius: '50%',
                            fontSize: '1.2rem',
                            cursor: 'pointer'
                        }}
                    >✕</button>
                </div>
            )}

            {showTrailerLightbox && trailer && (
                <div 
                    className="lightbox-overlay" 
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowTrailerLightbox(false);
                    }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0, 0, 0, 0.95)',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999999,
                        cursor: 'default'
                    }}
                >
                    <style>{`
                        @keyframes lightboxZoom {
                            from { transform: scale(0.95); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                    <div 
                        style={{
                            width: '90%',
                            maxWidth: '960px',
                            aspectRatio: '16/9',
                            position: 'relative',
                            boxShadow: '0 25px 50px -12px rgba(229, 9, 20, 0.25)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid rgba(229, 9, 20, 0.2)',
                            animation: 'lightboxZoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
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
                            style={{ width: '100%', height: '100%' }}
                        />
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTrailerLightbox(false);
                            }}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: 'white',
                                padding: '10px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                zIndex: 10
                            }}
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
