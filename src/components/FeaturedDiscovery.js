import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Film, Plus, Shuffle, Sparkles } from "lucide-react";
import StarRating from './StarRating';
import { useVault } from "../context/VaultContext";
import { useAuth } from "../context/AuthContext";

export default function FeaturedDiscovery({ items, onSelect, onAdd }) {
    const [active, setActive] = useState(0);
    const { isInVault, totalItems, watchingCount, completedCount } = useVault();
    const { currentUser } = useAuth();
    const featured = items.filter(item => item.backdrop_path).slice(0, 5);
    useEffect(() => { setActive(0); }, [items]);
    const item = featured[active] || featured[0];
    if (!item) return null;
    const title = item.title || item.name;
    const artwork = item.backdrop_path.startsWith("http") ? item.backdrop_path : `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`;
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const type = item.type === "anime" ? "Anime" : item.media_type === "tv" ? "TV series" : "Movie";
    return (
        <div className="discovery-feature-layout">
            <section className="discovery-hero" aria-label="Featured titles">
                <img className="discovery-hero__art" key={artwork} src={artwork} alt="" fetchPriority="high" />
                <div className="discovery-hero__shade" />
                <div className="discovery-hero__content">
                    <span className="eyebrow hero-eyebrow"><span className="live-dot" /> IN THE SPOTLIGHT</span>
                    <h2>{title}</h2>
                    <div className="hero-meta"><StarRating value={item.vote_average} label="Community rating" /><span>{year}</span><span>{type}</span><span className="hero-trending">Trending this week</span></div>
                    <p>{item.overview || "A new story to get lost in. Explore the cast, trailers, and everything you need to pick your next watch."}</p>
                    <div className="hero-actions">
                        <button className="btn" onClick={() => onSelect(item)}><Film size={16} /> Explore title</button>
                        <button className={`btn btn--hero-secondary${isInVault(item.id) ? " btn--success" : ""}`} disabled={isInVault(item.id)} onClick={() => onAdd(item)}>{isInVault(item.id) ? <Check size={16} /> : <Plus size={16} />}{isInVault(item.id) ? "In your vault" : "Add to vault"}</button>
                    </div>
                </div>
                <div className="hero-pagination">
                    <div className="hero-dots">{featured.map((media, index) => <button key={media.id} className={index === active ? "active" : ""} aria-label={`Feature ${media.title || media.name}`} aria-pressed={index === active} onClick={() => setActive(index)} />)}</div>
                    <div className="hero-arrows"><button aria-label="Previous featured title" onClick={() => setActive((active + featured.length - 1) % featured.length)}><ChevronLeft size={17} /></button><button aria-label="Next featured title" onClick={() => setActive((active + 1) % featured.length)}><ChevronRight size={17} /></button></div>
                </div>
            </section>
            <aside className="discovery-side">
                <Link to="/shuffle" className="tonight-card">
                    <span className="eyebrow"><Shuffle size={13} /> THE DECISION, MADE</span>
                    <div className="poster-fan" aria-hidden="true">{items.filter(media => media.poster_path).slice(1, 4).map(media => <img key={media.id} alt="" src={media.poster_path.startsWith("http") ? media.poster_path : `https://image.tmdb.org/t/p/w185${media.poster_path}`} />)}</div>
                    <h3>Too many choices?</h3><p>Let a little chance pick tonight’s watch.</p>
                    <span className="tonight-card__action">Shuffle something great <ArrowUpRight size={16} /></span>
                </Link>
                <Link to={currentUser ? "/stats" : "/login"} className="vault-glance">
                    <span className="vault-glance__heading"><Sparkles size={14} /> {currentUser ? "YOUR VAULT, AT A GLANCE" : "EVERY STORY. ONE PLACE."}<ArrowUpRight size={14} /></span>
                    {currentUser ? <div className="vault-glance__stats"><div><strong>{totalItems}</strong><span>Saved</span></div><div><strong>{watchingCount}</strong><span>Watching</span></div><div><strong>{completedCount}</strong><span>Finished</span></div></div> : <p>Save your favorites. Track your progress. Make this space yours.</p>}
                </Link>
            </aside>
        </div>
    );
}
