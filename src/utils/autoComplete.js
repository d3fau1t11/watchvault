/* Shared helper used across Vault, Home, MediaModal and VaultContext to decide
   whether a Watching TV/Anime item should be auto-marked as Completed.

   A show is considered finished when the user has caught up to the very last
   available season AND episode — regardless of whether TMDB says the show is
   still in production. The old behaviour also required TMDB status to be
   "Ended"/"Canceled", which we keep as an additional qualifying path. */
export const shouldAutoComplete = (item, tmdbDetails) => {
    if (!item || !tmdbDetails) return false;
    if (item.type !== "tv" && item.type !== "anime") return false;
    if (item.status === "Completed") return false;

    const userSeason = item.season || 1;
    const userEpisode = item.episode || 0;

    const nonZeroSeasons = (tmdbDetails.seasons || [])
        .filter(s => s.season_number > 0);

    if (nonZeroSeasons.length === 0) return false;

    const lastSeason = nonZeroSeasons[nonZeroSeasons.length - 1];

    // Caught up to the final season & episode (works for ongoing shows too).
    const caughtUpToEnd =
        userSeason > lastSeason.season_number ||
        (userSeason === lastSeason.season_number &&
            userEpisode >= lastSeason.episode_count);

    if (caughtUpToEnd) return true;

    // Legacy path: TMDB says the show is over and the user is caught up.
    const isEndedOrCanceled =
        tmdbDetails.status === "Ended" || tmdbDetails.status === "Canceled";

    if (isEndedOrCanceled && lastSeason) {
        return (
            userSeason > lastSeason.season_number ||
            (userSeason === lastSeason.season_number &&
                userEpisode >= lastSeason.episode_count)
        );
    }

    return false;
};
