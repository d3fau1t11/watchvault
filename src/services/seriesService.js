import { getTVDetailsWithAiring, getSeasonDetails } from './tmdbApi';
import { getAnimeById } from './anilistApi';
import { normalizeSeries, playableEpisodes } from '../utils/series';

export const isAniListSeries = item => item?.type === 'anime' && /^https?:/.test(item.poster || item.poster_path || '');

export async function verifySeriesDetails(item, details, { strict = true } = {}) {
    const normalized = normalizeSeries(details);
    if (isAniListSeries(item)) return normalized;
    const verified = [];
    // Bound concurrent requests while checking actual episode lists, including
    // seasons whose summary says they have episodes but whose list is empty.
    for (let index = 0; index < normalized.seasons.length; index += 4) {
        const group = await Promise.all(normalized.seasons.slice(index, index + 4).map(async season => {
            const data = await getSeasonDetails(item.tmdbId || item.id, season.season_number);
            if (!data || !Array.isArray(data.episodes)) {
                if (strict) throw new Error('Could not verify episodes');
                return season;
            }
            const episodes = playableEpisodes(data.episodes);
            return { ...season, episode_count: episodes[episodes.length - 1]?.episode_number || 0, available_episode_count: episodes.length, episode_numbers: episodes.map(episode => episode.episode_number) };
        }));
        verified.push(...group);
    }
    return normalizeSeries({ ...normalized, seasons: verified });
}

export async function getSeriesDetails(item) {
    if (isAniListSeries(item)) {
        const anime = await getAnimeById(item.tmdbId || item.id);
        if (!anime) throw new Error('Could not load series metadata');
        return normalizeSeries({ id: anime.id, seasons: [{ season_number: 1, episode_count: anime.episodes || 0 }], next_episode_to_air: anime.nextAiringEpisode ? { season_number: 1, episode_number: anime.nextAiringEpisode.episode, air_date: new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString().slice(0, 10) } : null });
    }
    const details = await getTVDetailsWithAiring(item.tmdbId || item.id);
    if (!details || !Array.isArray(details.seasons)) throw new Error('Could not load series metadata');
    return verifySeriesDetails(item, details);
}

export async function getNextSeriesProgress(item, details) {
    const seasons = details.seasons;
    for (const season of seasons) {
        if (season.season_number < (item.season || seasons[0]?.season_number)) continue;
        const start = season.season_number === item.season ? (item.episode || 0) : 0;
        if (isAniListSeries(item)) {
            if (start < season.episode_count) return { season: season.season_number, episode: start + 1 };
        } else {
            const data = await getSeasonDetails(item.tmdbId || item.id, season.season_number);
            if (!data) throw new Error('Could not load episodes. Your progress has not changed.');
            const next = playableEpisodes(data.episodes).find(episode => episode.episode_number > start);
            if (next) return { season: season.season_number, episode: next.episode_number };
        }
    }
    return null;
}
