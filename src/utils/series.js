function validReleaseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isReleasedDate(value, asOf = new Date()) {
    if (!validReleaseDate(value)) return false;
    const today = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(asOf.getDate()).padStart(2, '0')}`;
    return value <= today;
}

export const playableSeasons = details => (details?.seasons || [])
    .filter(season => Number.isInteger(season?.season_number) && season.season_number > 0 && Number.isFinite(season.episode_count) && season.episode_count > 0)
    // Announced seasons can contain numbered placeholder episodes. A future
    // premiere does not make them available to watch or count as released.
    .filter(season => !season.air_date || isReleasedDate(season.air_date))
    .sort((a, b) => a.season_number - b.season_number);

export const playableEpisodes = (episodes, { allowUndated = true, asOf = new Date() } = {}) => (episodes || [])
    .filter(episode => Number.isInteger(episode?.episode_number) && episode.episode_number > 0)
    .filter(episode => episode.air_date === undefined && allowUndated ? true : isReleasedDate(episode.air_date, asOf))
    .sort((a, b) => a.episode_number - b.episode_number);

export function normalizeSeries(details) {
    if (!details) return details;
    const seasons = playableSeasons(details);
    const next = details.next_episode_to_air;
    return { ...details, seasons, number_of_seasons: seasons.length,
        number_of_episodes: seasons.reduce((total, season) => total + (season.available_episode_count ?? season.episode_count), 0),
        // Upcoming episodes remain usable by the airing calendar, without
        // entering the released-season count or watch-progress controls.
        next_episode_to_air: next && next.episode_number > 0 && (
            (validReleaseDate(next.air_date) && !isReleasedDate(next.air_date)) ||
            seasons.some(season => season.season_number === next.season_number && (season.episode_numbers ? season.episode_numbers.includes(next.episode_number) : next.episode_number <= season.episode_count))
        ) ? next : null };
}

export function normalizeProgress(item, details) {
    const seasons = playableSeasons(details);
    if (!seasons.length) return { season: null, episode: 0, hasEpisodes: false };
    const number = Number.isInteger(item.season) && item.season > 0 ? item.season : seasons[0].season_number;
    const current = seasons.find(season => season.season_number === number);
    if (current) {
        let episode = Math.max(0, Math.min(Math.floor(Number(item.episode) || 0), current.episode_count));
        if (current.episode_numbers) episode = current.episode_numbers.filter(value => value <= episode).pop() || 0;
        return { season: number, episode, hasEpisodes: true };
    }
    // Progress in a deleted/empty season belongs to the last real season before it.
    const previous = seasons.filter(season => season.season_number < number).pop();
    return previous ? { season: previous.season_number, episode: previous.episode_count, hasEpisodes: true }
        : { season: seasons[0].season_number, episode: 0, hasEpisodes: true };
}

export function nextProgress(item, details) {
    const seasons = playableSeasons(details);
    if (!seasons.length) return null;
    const progress = normalizeProgress(item, details);
    const current = seasons.find(season => season.season_number === progress.season);
    if (progress.episode < current.episode_count) return { season: progress.season, episode: current.episode_numbers?.find(number => number > progress.episode) || progress.episode + 1 };
    const next = seasons.find(season => season.season_number > progress.season);
    return next ? { season: next.season_number, episode: next.episode_numbers?.[0] || 1 } : { season: progress.season, episode: current.episode_count };
}
