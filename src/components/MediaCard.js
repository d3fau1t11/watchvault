import { Plus, Check } from "lucide-react";

function MediaCard({ item, onAdd, onClick, isAdded }) {
    const posterUrl = item.poster_path
        ? (item.poster_path.startsWith("http://") || item.poster_path.startsWith("https://")
            ? item.poster_path
            : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
        : null;

    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").substring(0, 4);

    return (
        <div className={`media-card${onClick ? '' : ' media-card--static'}`} onClick={onClick}>
            <div className="media-poster-container">
                {posterUrl ? (
                    <img src={posterUrl} alt={title} className="media-poster" loading="lazy" />
                ) : (
                    <div className="no-poster">
                        <span>No Image Available</span>
                    </div>
                )}
            </div>
            <div className="media-info">
                <div className="media-meta">
                    <span className="media-type">
                        {(item.type === "anime" || item.media_type === "anime") 
                            ? "Anime" 
                            : (item.media_type || item.type) === "tv" 
                                ? "TV Series" 
                                : (item.media_type || item.type)}
                    </span>
                    <span>{year}</span>
                </div>
                <h3 className="media-title">{title}</h3>
                
                {onAdd && (
                    <button
                        className={`btn add-btn${isAdded ? ' add-btn--added' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isAdded) onAdd(item);
                        }}
                    >
                        {isAdded ? <><Check size={16} /> In Vault</> : <><Plus size={16} /> Add to Vault</>}
                    </button>
                )}
            </div>
        </div>
    );
}

export default MediaCard;
