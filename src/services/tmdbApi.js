const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

const apiCache = new Map();

const fetchWithCache = async (url) => {
    if (apiCache.has(url)) {
        return apiCache.get(url);
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDb API request failed: ${response.status}`);
    }
    const data = await response.json();
    apiCache.set(url, data);
    return data;
};

const fetchWithCacheSilent = async (url) => {
    if (apiCache.has(url)) {
        return apiCache.get(url);
    }
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        apiCache.set(url, data);
        return data;
    } catch (e) {
        return null;
    }
};

export const searchMedia = async (query, page = 1, type = "all") => {
    const endpoint = type === "movie" ? "movie" : type === "tv" ? "tv" : "multi";
    const data = await fetchWithCache(
        `${BASE_URL}/search/${endpoint}?api_key=${API_KEY}&query=${query}&page=${page}`
    );
    if (data && data.results && (type === "movie" || type === "tv")) {
        data.results = data.results.map(item => ({ ...item, media_type: type }));
    }
    return data;
};

export const getTrending = async (page = 1, type = "all") => {
    const endpoint = type === "movie" ? "movie" : type === "tv" ? "tv" : "all";
    const data = await fetchWithCache(
        `${BASE_URL}/trending/${endpoint}/week?api_key=${API_KEY}&page=${page}`
    );
    if (data && data.results && (type === "movie" || type === "tv")) {
        data.results = data.results.map(item => ({ ...item, media_type: type }));
    }
    return data;
};

export const getMediaDetails = async (id, type) => {
    // type must be 'movie' or 'tv'
    return fetchWithCache(
        `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos,credits,recommendations`
    );
};

export const getPersonDetails = async (id) => {
    return fetchWithCache(
        `${BASE_URL}/person/${id}?api_key=${API_KEY}&append_to_response=combined_credits`
    );
};

export const getEpisodeDetails = async (tvId, seasonNumber, episodeNumber) => {
    return fetchWithCacheSilent(
        `${BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${API_KEY}`
    );
};

export const getSeasonDetails = async (tvId, seasonNumber) => {
    return fetchWithCacheSilent(
        `${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`
    );
};

export const getRecommendations = async (id, type) => {
    // type must be 'movie' or 'tv'
    return fetchWithCacheSilent(
        `${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}`
    );
};

export const getWatchProviders = async (id, type) => {
    // type must be 'movie' or 'tv'
    return fetchWithCacheSilent(
        `${BASE_URL}/${type}/${id}/watch/providers?api_key=${API_KEY}`
    );
};

export const getTVDetailsWithAiring = async (id) => {
    return fetchWithCache(
        `${BASE_URL}/tv/${id}?api_key=${API_KEY}`
    );
};

export const discoverMedia = async (type = "movie", page = 1, genreId = null, includeAdult = false) => {
    let url = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&page=${page}&sort_by=popularity.desc&include_adult=${includeAdult}`;
    if (genreId && genreId !== "adult") {
        url += `&with_genres=${genreId}`;
    }
    return fetchWithCacheSilent(url);
};

export const getMovieGenres = async () => {
    return fetchWithCache(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
};

export const getTVGenres = async () => {
    return fetchWithCache(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`);
};
