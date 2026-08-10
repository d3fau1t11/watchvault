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

export const searchMedia = async (query, page = 1) => {
    return fetchWithCache(
        `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}&page=${page}`
    );
};

export const getTrending = async (page = 1) => {
    return fetchWithCache(
        `${BASE_URL}/trending/all/week?api_key=${API_KEY}&page=${page}`
    );
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
