import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { searchMedia } from "../services/tmdbApi";

function SearchBar({ query, setQuery, onSearch }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced search for suggestions
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (query.trim().length < 2) {
                setSuggestions([]);
                return;
            }
            try {
                const data = await searchMedia(query);
                const filtered = data.results ? data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 5) : [];
                setSuggestions(filtered);
            } catch (error) {
                console.error("Failed to fetch suggestions", error);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchSuggestions();
        }, 300); // 300ms delay

        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            setShowSuggestions(false);
            onSearch(query);
        }
    };

    const handleSuggestionClick = (title) => {
        setQuery(title);
        setShowSuggestions(false);
        onSearch(title);
    };

    const handleClear = () => {
        setQuery("");
        setShowSuggestions(false);
        onSearch("");
    };

    return (
        <div ref={wrapperRef} className="search-wrap">
            <form className="search-container" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search movies, TV series, or anime..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                />
                {query && (
                    <button
                        type="button"
                        className="search-clear"
                        onClick={handleClear}
                        title="Clear Search"
                        aria-label="Clear search"
                    >
                        <X size={18} />
                    </button>
                )}
                <button type="submit" className="btn search-btn" aria-label="Search">
                    <Search size={20} />
                </button>
            </form>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-dropdown">
                    {suggestions.map((item) => {
                        const title = item.title || item.name;
                        const year = (item.release_date || item.first_air_date || "").substring(0, 4);
                        const posterUrl = item.poster_path ? (item.poster_path.startsWith("http://") || item.poster_path.startsWith("https://") ? item.poster_path : `https://image.tmdb.org/t/p/w92${item.poster_path}`) : null;
                        
                        return (
                            <li key={item.id} className="suggestion-item" onClick={() => handleSuggestionClick(title)}>
                                {posterUrl ? (
                                    <img src={posterUrl} alt={title} className="suggestion-poster" />
                                ) : (
                                    <div className="suggestion-no-poster">No img</div>
                                )}
                                <div className="suggestion-info">
                                    <span className="suggestion-title">{title}</span>
                                    <span className="suggestion-meta">
                                        {item.media_type === "tv" ? "TV" : "Movie"} {year ? `• ${year}` : ''}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default SearchBar;