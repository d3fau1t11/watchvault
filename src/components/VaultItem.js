import { Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getEpisodeDetails } from "../services/tmdbApi";

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
        <div className="vault-item" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            {posterUrl ? (
                <img src={posterUrl} alt={item.title} className="vault-poster" loading="lazy" />
            ) : (
                <div className="vault-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1d24' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No Image</span>
                </div>
            )}
            <div className="vault-info">
                <div className="vault-details">
                    <h3 className="vault-title">{item.title}</h3>
                    {episodeName && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px', display: 'block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {`S${item.season || 1} E${item.episode || 0}: ${episodeName}`}
                        </span>
                    )}

                    {/* Interactive Watch Progress Tracker */}
                    {(item.type === 'tv' || item.type === 'anime') && (
                        <div 
                            onClick={(e) => e.stopPropagation()} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                marginTop: '8px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                width: 'fit-content'
                            }}
                        >
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>S</span>
                            <input 
                                type="number" 
                                value={item.season || 1} 
                                min="1"
                                onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    onUpdateProgress(item.id, val, item.episode || 0);
                                }}
                                style={{
                                    width: '32px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    textAlign: 'center',
                                    padding: '0',
                                    fontWeight: '600',
                                    outline: 'none'
                                }}
                                title="Season"
                            />
                            
                            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>EP</span>
                                <input 
                                    type="number" 
                                    value={item.episode || 0} 
                                    min="0"
                                    onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        onUpdateProgress(item.id, item.season || 1, val);
                                        if (val > 0 && item.status === "Plan to Watch") {
                                            onUpdateStatus(item.id, "Watching");
                                        }
                                    }}
                                    style={{
                                        width: '30px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '0.78rem',
                                        textAlign: 'center',
                                        fontWeight: '700',
                                        outline: 'none',
                                        padding: '0'
                                    }}
                                    title="Episode Number"
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="vault-actions">
                    <select 
                        className="status-select"
                        value={item.type}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateType(item.id, e.target.value)}
                        style={{ borderColor: 'rgba(229, 9, 20, 0.4)' }}
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
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VaultItem;
