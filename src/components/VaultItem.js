import { Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getMediaDetails } from "../services/tmdbApi";

const STATUS_MODIFIER = {
    "Plan to Watch": "pill--plan",
    "Watching": "pill--watching",
    "Completed": "pill--done",
};

const STATUS_SHORT = {
    "Plan to Watch": "Planned",
    "Watching": "Watching",
    "Completed": "Done",
};

function VaultItem({ item, onUpdateStatus, onUpdateType, onRemove, onClick }) {
    const [seasonCount, setSeasonCount] = useState(null);

    useEffect(() => {
        const fetchSeasonCount = async () => {
            if ((item.type === "tv" || item.type === "anime") && item.tmdbId) {
                try {
                    const type = item.type === "anime" ? "tv" : item.type;
                    const details = await getMediaDetails(item.tmdbId, type);
                    if (details && details.number_of_seasons) {
                        setSeasonCount(details.number_of_seasons);
                    }
                } catch (err) {
                    console.error("Failed to fetch season count for", item.title, err);
                }
            }
        };

        fetchSeasonCount();
    }, [item.type, item.tmdbId, item.title]);

    const posterUrl = item.poster
        ? (item.poster.startsWith("http://") || item.poster.startsWith("https://")
            ? item.poster
            : `https://image.tmdb.org/t/p/w342${item.poster}`)
        : null;

    return (
        <div className={`vault-item${onClick ? "" : " vault-item--static"}`} onClick={onClick}>
            {posterUrl ? (
                <img src={posterUrl} alt={item.title} className="vault-poster" loading="lazy" />
            ) : (
                <div className="vault-poster poster-ph">No Image</div>
            )}
            <div className="vault-info">
                <div className="vault-details">
                    <div className="vault-title-row">
                        <h3 className="vault-title">{item.title}</h3>
                        <span className={`pill pill--status ${STATUS_MODIFIER[item.status] || "pill--plan"}`}>
                            {STATUS_SHORT[item.status] || item.status}
                        </span>
                        {item.rating > 0 && (
                            <span className="pill pill--star">★ {item.rating}</span>
                        )}
                        {item.category && (
                            <span className="pill pill--category">{item.category}</span>
                        )}
                    </div>

                    {/* Read-only season count for TV/Anime */}
                    {(item.type === "tv" || item.type === "anime") && seasonCount !== null && (
                        <span className="vault-season-count">
                            {seasonCount === 1 ? "1 season" : `${seasonCount} seasons`}
                        </span>
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
