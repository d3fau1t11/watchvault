/* Single source of truth for vault categories.
   Pure functions only — no imports — so services, pages and components can all
   share the same mapping without a dependency cycle. */

export const STANDARD_CATEGORIES = [
    "Uncategorized",
    "Action",
    "Adventure",
    "Animation",
    "Anime",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Kids",
    "Music",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Thriller",
    "War",
    "Western"
];

/* Genre name (lower-cased) -> standard category.
   Covers TMDB movie genres, TMDB TV genres (which use different names for the
   same ideas, e.g. "Sci-Fi & Fantasy") and AniList genres. */
const GENRE_TO_CATEGORY = {
    // TMDB movie genres
    "action": "Action",
    "adventure": "Adventure",
    "animation": "Animation",
    "comedy": "Comedy",
    "crime": "Crime",
    "documentary": "Documentary",
    "drama": "Drama",
    "family": "Family",
    "fantasy": "Fantasy",
    "history": "History",
    "horror": "Horror",
    "music": "Music",
    "musical": "Music",
    "mystery": "Mystery",
    "romance": "Romance",
    "science fiction": "Sci-Fi",
    "sci-fi": "Sci-Fi",
    "thriller": "Thriller",
    "war": "War",
    "western": "Western",

    // TMDB TV genres
    "action & adventure": "Action",
    "kids": "Kids",
    "sci-fi & fantasy": "Sci-Fi",
    "war & politics": "War",

    // AniList genres not already covered above
    "mecha": "Sci-Fi",
    "psychological": "Thriller",
    "slice of life": "Drama",
    "supernatural": "Fantasy",
    "mahou shoujo": "Fantasy",
    "sports": "Family"
};

/* Genre names the old auto-assign could write straight into `category` even
   though they are not offered in the dropdown. A person picking from the select
   could never produce these, so normalising them is safe — unlike a genuine
   custom category, which we always leave alone. */
const LEGACY_AUTO_CATEGORIES = new Set([
    "Action & Adventure",
    "Sci-Fi & Fantasy",
    "War & Politics",
    "Science Fiction",
    "TV Movie",
    "News",
    "Reality",
    "Soap",
    "Talk",
    "Unknown"
]);

/* Vault items have carried `genres` as either a string[] or the raw TMDB
   {id, name}[], depending on when they were added. */
export function genreNames(genres) {
    if (!Array.isArray(genres)) return [];
    return genres
        .map((g) => (typeof g === "string" ? g : g?.name))
        .filter((name) => typeof name === "string" && name.trim() !== "");
}

/* Picks the first genre that maps to a standard category. Iterating rather than
   taking genres[0] matters because TMDB's first genre is often an unmappable
   format tag like "TV Movie". */
export function deriveCategory(item) {
    if (!item) return "Uncategorized";

    // Anime has a category of its own, so it never needs a genre lookup.
    if (item.type === "anime") return "Anime";

    for (const name of genreNames(item.genres)) {
        const mapped = GENRE_TO_CATEGORY[name.trim().toLowerCase()];
        if (mapped) return mapped;
    }

    return "Uncategorized";
}

/* True when a category is absent, explicitly "Uncategorized", or one of the
   machine-written legacy names above. */
export function needsCategory(item) {
    const current = (item?.category || "").trim();
    if (!current || current === "Uncategorized") return true;
    return LEGACY_AUTO_CATEGORIES.has(current);
}

/* True when we cannot derive a category without fetching genres first. */
export function needsGenreLookup(item) {
    if (!item || item.type === "anime") return false;
    return genreNames(item.genres).length === 0;
}
