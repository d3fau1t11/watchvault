import { normalizeSeries, normalizeProgress, nextProgress, playableEpisodes, isReleasedDate } from './series';
import { shouldAutoComplete } from './autoComplete';
import { getSeriesDetails, getNextSeriesProgress } from '../services/seriesService';
import { getTVDetailsWithAiring, getSeasonDetails } from '../services/tmdbApi';
jest.mock('../services/tmdbApi', () => ({ getTVDetailsWithAiring: jest.fn(), getSeasonDetails: jest.fn() }));
jest.mock('../services/anilistApi', () => ({ getAnimeById: jest.fn() }));

const details = { seasons: [{ season_number: 3, episode_count: 2 }, { season_number: 1, episode_count: 3 }, { season_number: 2, episode_count: 0 }, { season_number: 4, episode_count: 0 }, { season_number: 0, episode_count: 9 }] };
const item = { id: 'saved', tmdbId: 101, type: 'tv', status: 'Watching', season: 1, episode: 3 };

test('empty seasons and specials do not count as playable seasons or episodes', () => {
    expect(normalizeSeries(details)).toMatchObject({ number_of_seasons: 2, number_of_episodes: 5, seasons: [{ season_number: 1 }, { season_number: 3 }] });
    expect(nextProgress(item, details)).toEqual({ season: 3, episode: 1 });
    expect(normalizeSeries({ ...details, next_episode_to_air: { season_number: 4, episode_number: 1 } }).next_episode_to_air).toBeNull();
});
test('existing progress in empty seasons is repaired and completion uses the last real episode', () => {
    expect(normalizeProgress({ ...item, season: 2, episode: 5 }, details)).toEqual({ season: 1, episode: 3, hasEpisodes: true });
    expect(normalizeProgress({ ...item, season: 4, episode: 0 }, details)).toEqual({ season: 3, episode: 2, hasEpisodes: true });
    expect(shouldAutoComplete({ ...item, season: 3, episode: 2 }, details)).toBe(true);
    expect(shouldAutoComplete(item, details)).toBe(false);
    expect(shouldAutoComplete(item, { seasons: [{ season_number: 1, episode_count: 0 }] })).toBe(false);
    expect(normalizeProgress(item, { seasons: [] })).toEqual({ season: null, episode: 0, hasEpisodes: false });
});
test('actual empty episode lists override nonempty season summaries and gaps are skipped', async () => {
    getTVDetailsWithAiring.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }, { season_number: 2, episode_count: 5 }] });
    getSeasonDetails.mockImplementation(async (id, season) => ({ episodes: season === 1 ? [{ episode_number: 0 }, { episode_number: 1 }, { episode_number: 3 }] : [] }));
    const verified = await getSeriesDetails(item);
    expect(verified.number_of_seasons).toBe(1);
    expect(verified.number_of_episodes).toBe(2);
    expect(normalizeProgress({ ...item, episode: 2 }, verified).episode).toBe(1);
    expect(normalizeSeries({ ...verified, next_episode_to_air: { season_number: 1, episode_number: 2 } }).next_episode_to_air).toBeNull();
    expect(await getNextSeriesProgress({ ...item, episode: 1 }, verified)).toEqual({ season: 1, episode: 3 });
});
test('a failed episode request never gets interpreted as an empty season', async () => {
    getTVDetailsWithAiring.mockResolvedValue(details);
    getSeasonDetails.mockResolvedValue(null);
    await expect(getSeriesDetails(item)).rejects.toThrow('Could not verify episodes');
});

test('Silo counts three released seasons and excludes the fourth season’s planned episode', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    try {
        const silo = { id: 125988, name: 'Silo', seasons: [
            { season_number: 1, episode_count: 10, air_date: '2023-05-04' },
            { season_number: 2, episode_count: 10, air_date: '2024-11-14' },
            { season_number: 3, episode_count: 10, air_date: '2026-07-02' },
            { season_number: 4, episode_count: 1, air_date: '2027-07-08' }
        ], next_episode_to_air: { season_number: 4, episode_number: 1, air_date: '2027-07-08' } };
        getTVDetailsWithAiring.mockResolvedValue(silo);
        getSeasonDetails.mockImplementation(async (id, season) => ({ episodes: Array.from({ length: season === 4 ? 1 : 10 }, (_, index) => ({ episode_number: index + 1, air_date: season === 4 ? '2027-07-08' : '2026-09-03' })) }));
        const verified = await getSeriesDetails({ type: 'tv', tmdbId: 125988 });
        expect(verified.number_of_seasons).toBe(3);
        expect(verified.number_of_episodes).toBe(30);
        expect(verified.next_episode_to_air).toEqual(silo.next_episode_to_air);
        expect(normalizeProgress({ season: 4, episode: 1 }, verified)).toEqual({ season: 3, episode: 10, hasEpisodes: true });
        expect(shouldAutoComplete({ type: 'tv', status: 'Watching', season: 3, episode: 10 }, verified)).toBe(true);
        expect(await getNextSeriesProgress({ type: 'tv', tmdbId: 125988, season: 3, episode: 10 }, verified)).toBeNull();
    } finally { jest.useRealTimers(); }
});

test('only released, dated TMDb episodes can be tracked, while future dates stay scheduled', () => {
    const asOf = new Date('2026-11-24T12:00:00Z');
    const episodes = [
        { episode_number: 1, air_date: '2026-11-23' },
        { episode_number: 2, air_date: '2026-11-24' },
        { episode_number: 3, air_date: '2026-11-25' },
        { episode_number: 4, air_date: null },
        { episode_number: 5 },
        { episode_number: 6, air_date: '2026-02-31' }
    ];
    expect(playableEpisodes(episodes, { allowUndated: false, asOf }).map(episode => episode.episode_number)).toEqual([1, 2]);
    expect(isReleasedDate('2026-02-31', asOf)).toBe(false);
});
