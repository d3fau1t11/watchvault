const ANILIST_API = 'https://graphql.anilist.co';

const apiCache = new Map();

const fetchWithCache = async (url, body) => {
  const cacheKey = JSON.stringify(body);
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`AniList API request failed: ${response.status}`);
  }

  const data = await response.json();
  apiCache.set(cacheKey, data);
  return data;
};

export const searchAnime = async (search, page = 1, perPage = 10) => {
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(search: $search, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          description
          seasonYear
          format
          studios { nodes { name } }
        }
      }
    }
  `;

  const response = await fetchWithCache(ANILIST_API, {
    query,
    variables: { search, page, perPage }
  });

  return response.data.Page;
};

export const getTrendingAnime = async (page = 1, perPage = 10) => {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          description
          seasonYear
          format
          studios { nodes { name } }
        }
      }
    }
  `;

  const response = await fetchWithCache(ANILIST_API, {
    query,
    variables: { page, perPage }
  });

  return response.data.Page;
};

export const getTopRatedAnime = async (page = 1, perPage = 10) => {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, sort: SCORE_DESC) {
          id
          title { romaji english native }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          description
          seasonYear
          format
          studios { nodes { name } }
        }
      }
    }
  `;

  const response = await fetchWithCache(ANILIST_API, {
    query,
    variables: { page, perPage }
  });

  return response.data.Page;
};

export const getAnimeById = async (id) => {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        coverImage { large medium extraLarge }
        bannerImage
        episodes
        averageScore
        genres
        status
        description
        seasonYear
        format
        studios { nodes { name } }
        startDate { year month day }
        endDate { year month day }
        nextAiringEpisode { airingAt episode }
        streamingEpisodes { title thumbnail url }
      }
    }
  `;

  const response = await fetchWithCache(ANILIST_API, {
    query,
    variables: { id }
  });

  return response.data.Media;
};

// Helper function to convert AniList data to match TMDb format for consistency
export const convertAnilistToTmdbFormat = (anilistMedia) => {
  return {
    id: anilistMedia.id,
    tmdbId: anilistMedia.id, // Use AniList ID as tmdbId for consistency
    title: anilistMedia.title.english || anilistMedia.title.romaji,
    name: anilistMedia.title.english || anilistMedia.title.romaji,
    poster_path: anilistMedia.coverImage.large,
    backdrop_path: anilistMedia.bannerImage,
    vote_average: anilistMedia.averageScore / 10, // Convert 0-100 to 0-10
    overview: anilistMedia.description,
    media_type: 'tv', // Treat anime as TV for consistency
    type: 'anime',
    first_air_date: anilistMedia.startDate ? 
      `${anilistMedia.startDate.year}-${String(anilistMedia.startDate.month).padStart(2, '0')}-${String(anilistMedia.startDate.day).padStart(2, '0')}` : 
      null,
    genre_ids: [], // AniList uses genre names, not IDs
    genres: anilistMedia.genres,
    episodes: anilistMedia.episodes,
    status: anilistMedia.status,
    studios: anilistMedia.studios?.nodes?.map(s => s.name) || []
  };
};
