import { Plus, Check, Film, ArrowUpRight } from "lucide-react";
import StarRating from './StarRating';

function MediaCard({ item, onAdd, onClick, isAdded }) {
    const posterUrl = item.poster_path
        ? (item.poster_path.startsWith("http://") || item.poster_path.startsWith("https://")
            ? item.poster_path
            : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
        : null;

    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").substring(0, 4);

    return (
        <article className={`media-card${onClick ? '' : ' media-card--static'}`}>
            <div className="media-poster-container">
                <button className="media-open" onClick={onClick} disabled={!onClick} aria-label={`View details for ${title}`}>
                {posterUrl ? (
                    <img src={posterUrl} alt={title} className="media-poster" loading="lazy" />
                ) : (
                    <div className="no-poster">
                        <Film size={30} /><span>{title}</span>
                    </div>
                )}
                <span className="media-open-hint">Explore title <ArrowUpRight size={16} /></span>
                </button>
                {item.vote_average > 0 && <span className="card-rating"><StarRating value={item.vote_average} size={10} label="Community rating" /></span>}
                {onAdd && <button className={`card-save${isAdded ? ' card-save--added' : ''}`} onClick={() => onAdd(item)} disabled={isAdded} aria-label={isAdded ? `${title} is in your vault` : `Add ${title} to vault`}>{isAdded ? <Check size={17} /> : <Plus size={17} />}</button>}
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
                <h3 className="media-title"><button onClick={onClick} disabled={!onClick}>{title}</button></h3>
            </div>
        </article>
    );
}

export default MediaCard;
