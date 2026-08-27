import { Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getEpisodeDetails } from "../services/tmdbApi";

const STATUS_MODIFIER = {
    "Plan to Watch": "pill--plan",
    "Watching": "pill--watching",
    "Completed": "pill--done"
};

const STATUS_SHORT = {
    "Plan to Watch": "Planned",
    "Watching": "Watching",
    "Completed": "Done"
};

function VaultItem({ item, onUpdateStatus, onUpdateType, onUpdateProgress, onRemove, onClick }) {
    const [episodeName, setEpisodeName] = useState(null);

    useEffect(() => {
        const fetchEpisode = async () => {
            if ((item.type === 'tv' || item.type === 'anime') && item.tmdbId && item.season > 0 && item.episode > 0) {
                const data = await getEpisodeDetails(item.tmdbId, item.season, item.episode);
                if (data && data.name) {
                    setEpisodeName(data.name);
                } else {
                    setEpisodeName(null);
                }
            } else {
                setEpisodeName(null);
            }
        };

        // Add a slight debounce to avoid spamming the API if the user clicks '+' fast
        const timeoutId = setTimeout(() => {
            fetchEpisode();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [item.type, item.tmdbId, item.season, item.episode]);
    const posterUrl = item.poster
        ? (item.poster.startsWith("http://") || item.poster.startsWith("https://")
            ? item.poster
            : `https://image.tmdb.org/t/p/w342${item.poster}`)
        : null;

    return (
        <div className={`vault-item${onClick ? '' : ' vault-item--static'}`} onClick={onClick}>
            {posterUrl ? (
                <img src={posterUrl} alt={item.title} className="vault-poster" loading="lazy" />
            ) : (
                <div className="vault-poster poster-ph">No Image</div>
            )}
            <div className="vault-info">
                <div className="vault-details">
                    <div className="vault-title-row">
                        <h3 className="vault-title">{item.title}</h3>
                        <span className={`pill pill--status ${STATUS_MODIFIER[item.status] || 'pill--plan'}`}>
                            {STATUS_SHORT[item.status] || item.status}
                        </span>
                        {item.rating > 0 && (
                            <span className="pill pill--star">★ {item.rating}</span>
                        )}
                        {item.category && (
                            <span className="pill pill--category">{item.category}</span>
                        )}
                    </div>
                    {episodeName && (
                        <span className="vault-episode-name">
                            {`S${item.season || 1} E${item.episode || 0}: ${episodeName}`}
                        </span>
                    )}

                    {/* Interactive Watch Progress Tracker */}
                    {(item.type === 'tv' || item.type === 'anime') && (
                        <div className="stepper" onClick={(e) => e.stopPropagation()}>
                            <div className="stepper__group">
                                <span className="stepper__label">S</span>
                                <input
                                    type="number"
                                    className="stepper__input"
                                    value={item.season || 1}
                                    min="1"
                                    onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        onUpdateProgress(item.id, val, item.episode || 0);
                                    }}
                                    title="Season"
                                />
                            </div>

                            <span className="stepper__divider" />

                            <div className="stepper__group">
                                <span className="stepper__label">EP</span>
                                <input
                                    type="number"
                                    className="stepper__input"
                                    value={item.episode || 0}
                                    min="0"
                                    onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        onUpdateProgress(item.id, item.season || 1, val);
                                        if (val > 0 && item.status === "Plan to Watch") {
                                            onUpdateStatus(item.id, "Watching");
                                        }
                                    }}
                                    title="Episode Number"
                                />
                            </div>
                        </div>
                    )}

                    {/* Display tags inside Vault items list */}
                    {item.tags && item.tags.length > 0 && (
                        <div className="vault-tags">
                            {item.tags.map((tag, idx) => (
                                <span key={idx} className="pill pill--tag">#{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="vault-actions">
                    <select
                        className="status-select"
                        value={item.type}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateType(item.id, e.target.value)}
                        title="Media type"
                    >
                        <option value="movie">Movie</option>
                        <option value="tv">TV Series</option>
                        <option value="anime">Anime</option>
                    </select>

                    <select
                        className="status-select"
                        value={item.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateStatus(item.id, e.target.value)}
                        title="Watch status"
                    >
                        <option value="Plan to Watch">Plan to Watch</option>
                        <option value="Watching">Watching</option>
                        <option value="Completed">Completed</option>
                    </select>

                    {/* Progress tracking moved to MediaModal */}

                    <button
                        className="remove-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.id);
                        }}
                        title="Remove from Vault"
                        aria-label={`Remove ${item.title} from vault`}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VaultItem;
