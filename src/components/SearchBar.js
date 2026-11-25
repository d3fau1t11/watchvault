import { useState, useEffect, useRef } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { searchMedia } from "../services/tmdbApi";
import { searchAnime, convertAnilistToTmdbFormat } from "../services/anilistApi";

function SearchBar({ query, setQuery, onSearch, contentType = "all" }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const outside = event => { if (!wrapperRef.current?.contains(event.target)) setShowSuggestions(false); };
        document.addEventListener("mousedown", outside);
        return () => document.removeEventListener("mousedown", outside);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setSuggestions([]);
        setActiveIndex(-1);
        const timeout = setTimeout(async () => {
            if (query.trim().length < 2) return;
            try {
                const data = contentType === "anime" ? await searchAnime(query.trim(), 1, 5) : await searchMedia(query.trim(), 1, contentType === "movies" ? "movie" : contentType === "tv" ? "tv" : "all");
                const matches = contentType === "anime" ? data.media.map(convertAnilistToTmdbFormat) : (data.results || []).filter(item => item.media_type === "movie" || item.media_type === "tv");
                if (!cancelled) setSuggestions(matches.slice(0, 5));
            } catch { if (!cancelled) setSuggestions([]); }
        }, 300);
        return () => { cancelled = true; clearTimeout(timeout); };
    }, [query, contentType]);

    const choose = title => { setQuery(title); setShowSuggestions(false); setActiveIndex(-1); onSearch(title); };
    const open = showSuggestions && suggestions.length > 0;
    return (
        <div ref={wrapperRef} className="search-wrap">
            <form className="search-container" role="search" onSubmit={event => { event.preventDefault(); choose(query.trim()); }}>
                <Search size={19} className="search-leading-icon" aria-hidden="true" />
                <input id="media-search" type="search" className="search-input" placeholder="Search movies, series, or anime…" value={query}
                    aria-label="Search movies, series, or anime" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="search-suggestions"
                    aria-activedescendant={open && activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
                    autoComplete="off" onChange={event => { setQuery(event.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)} onKeyDown={event => {
                        if (event.key === "Escape") { setShowSuggestions(false); setActiveIndex(-1); }
                        if (open && event.key === "ArrowDown") { event.preventDefault(); setActiveIndex(index => (index + 1) % suggestions.length); }
                        if (open && event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(index => (index + suggestions.length - 1) % suggestions.length); }
                        if (open && event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); choose(suggestions[activeIndex].title || suggestions[activeIndex].name); }
                    }} />
                {query && <button type="button" className="search-clear" onClick={() => choose("")} aria-label="Clear search"><X size={17} /></button>}
                <button type="submit" className="search-btn" aria-label="Search"><ArrowRight size={19} /></button>
            </form>
            {open && <ul className="suggestions-dropdown" id="search-suggestions" role="listbox" aria-label="Suggested titles">
                {suggestions.map((item, index) => {
                    const title = item.title || item.name;
                    const poster = item.poster_path ? item.poster_path.startsWith("http") ? item.poster_path : `https://image.tmdb.org/t/p/w92${item.poster_path}` : null;
                    return <li key={`${item.media_type}-${item.id}`} id={`suggestion-${index}`} role="option" aria-selected={index === activeIndex} className={`suggestion-item${index === activeIndex ? " suggestion-item--active" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(title)}>
                        {poster ? <img src={poster} alt="" className="suggestion-poster" /> : <span className="suggestion-no-poster"><Search size={17} /></span>}
                        <span className="suggestion-info"><span className="suggestion-title">{title}</span><span className="suggestion-meta">{contentType === "anime" ? "Anime" : item.media_type === "tv" ? "TV series" : "Movie"} · {(item.release_date || item.first_air_date || "").slice(0, 4)}</span></span><ArrowRight size={15} />
                    </li>;
                })}
            </ul>}
        </div>
    );
}
export default SearchBar;
