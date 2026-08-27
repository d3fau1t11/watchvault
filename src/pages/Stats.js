import { useMemo } from "react";
import { useVault } from "../context/VaultContext";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { BarChart3, TrendingUp, Clock, Library } from "lucide-react";

/* Donut + legend read from the same array, so slice N and legend row N can
   never drift apart. Ordered to stay distinguishable at 10px swatch size. */
const CHART_COLORS = [
    "#E50914", // red
    "#3B82F6", // blue
    "#22C55E", // green
    "#F5A524", // amber
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#F97316", // orange
    "#6B6B78"  // grey
];

function Stats() {
    const { vaultItems, loading: vaultLoading } = useVault();
    const navigate = useNavigate();



    // Dynamic Watchlist Analytics Calculations
    const stats = useMemo(() => {
        const total = vaultItems.length;
        if (total === 0) {
            return {
                total: 0,
                moviesCount: 0,
                tvCount: 0,
                animeCount: 0,
                completed: 0,
                watching: 0,
                planToWatch: 0,
                completionRate: 0,
                hoursWatched: 0,
                watchingList: []
            };
        }

        const moviesCount = vaultItems.filter(item => item.type === 'movie').length;
        const tvCount = vaultItems.filter(item => item.type === 'tv').length;
        const animeCount = vaultItems.filter(item => item.type === 'anime').length;

        const completed = vaultItems.filter(item => item.status === 'Completed').length;
        const watching = vaultItems.filter(item => item.status === 'Watching').length;
        const planToWatch = vaultItems.filter(item => item.status === 'Plan to Watch').length;

        const completionRate = Math.round((completed / total) * 100);

        let totalMinutes = 0;
        const watchingList = [];

        vaultItems.forEach(item => {
            if (item.type === 'movie') {
                if (item.status === 'Completed') totalMinutes += 120;
                else if (item.status === 'Watching') {
                    totalMinutes += 60; // Halfway estimate
                    watchingList.push(item);
                }
            } else {
                // TV Series or Anime
                const eps = item.episode || 0;
                const minPerEp = item.type === 'anime' ? 24 : 45;
                totalMinutes += eps * minPerEp;

                if (item.status === 'Completed' && eps === 0) {
                    totalMinutes += 12 * minPerEp; // Assume average 1 season if empty progress
                }

                if (item.status === 'Watching') {
                    watchingList.push(item);
                }
            }
        });

        const hoursWatched = Math.round((totalMinutes / 60) * 10) / 10;

        const genresCountMap = {};
        let uncategorizedCount = 0;
        
        vaultItems.forEach(item => {
            if (item.genres && Array.isArray(item.genres) && item.genres.length > 0) {
                item.genres.forEach(genre => {
                    genresCountMap[genre] = (genresCountMap[genre] || 0) + 1;
                });
            } else {
                if (item.type === 'anime') {
                    genresCountMap["Animation"] = (genresCountMap["Animation"] || 0) + 1;
                } else {
                    uncategorizedCount++;
                }
            }
        });

        const genreData = Object.entries(genresCountMap)
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => b.count - a.count);

        if (uncategorizedCount > 0) {
            genreData.push({ genre: "Other/Uncategorized", count: uncategorizedCount });
        }

        return {
            total,
            moviesCount,
            tvCount,
            animeCount,
            completed,
            watching,
            planToWatch,
            completionRate,
            hoursWatched,
            watchingList: watchingList.slice(0, 6), // Display top 6 currently watching trackers
            genreData
        };
    }, [vaultItems]);

    if (vaultLoading) {
        return (
            <div className="page container">
                <div className="loading-state">
                    <div className="spinner" />
                    <span className="loading-state__label">Analyzing your Vault metrics…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page container">
            <div className="page-header">
                <div className="page-heading">
                    <h1 className="page-title">
                        <BarChart3 size={28} /> Vault Statistics
                    </h1>
                    <p className="page-subtitle">
                        Deep-dive tracking analytics, format distribution metrics, and watchlist watchtime reports.
                    </p>
                </div>
            </div>

            {vaultItems.length === 0 ? (
                <EmptyState
                    icon="library"
                    title="Your stats profile is empty!"
                    message="Add titles (movies, series, or anime) to your Vault and mark them as Completed or Watching, and we will automatically compile comprehensive progress reports!"
                    actionText="Explore & Search Titles"
                    onAction={() => navigate("/")}
                />
            ) : (
                <div className="stats-grid">
                    {/* CARD 1: Total Library size */}
                    <div className="stat-card">
                        <div>
                            <div className="stat-head">
                                <span className="stat-label">Total Library</span>
                                <Library size={18} />
                            </div>
                            <h4 className="stat-value">
                                {stats.total} <span className="stat-unit">Titles</span>
                            </h4>
                        </div>
                        <div className="stat-pills">
                            <span className="stats-distribution-pill">🎬 {stats.moviesCount} Movies</span>
                            <span className="stats-distribution-pill">📺 {stats.tvCount} Shows</span>
                            <span className="stats-distribution-pill">🛡️ {stats.animeCount} Anime</span>
                        </div>
                    </div>

                    {/* CARD 2: Total Hours Watched */}
                    <div className="stat-card">
                        <div>
                            <div className="stat-head">
                                <span className="stat-label">Estimated Watch Time</span>
                                <Clock size={18} />
                            </div>
                            <h4 className="stat-value">
                                {stats.hoursWatched} <span className="stat-unit">Hours</span>
                            </h4>
                        </div>
                        <div className="stat-note">
                            <span className="stat-em stat-em--done">Live computation</span> based on custom episode tracking progress.
                        </div>
                    </div>

                    {/* CARD 3: Watchlist Completion Percentage */}
                    <div className="stat-card stat-card--row">
                        {/* Circular Progress Gauge */}
                        <div className="gauge">
                            <svg>
                                <circle cx="40" cy="40" r="34" stroke="var(--surface-3)" strokeWidth="6" fill="transparent" />
                                <circle cx="40" cy="40" r="34" stroke="var(--accent)" strokeWidth="6" fill="transparent"
                                    strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 * (1 - stats.completionRate / 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="gauge__value">
                                {stats.completionRate}%
                            </div>
                        </div>

                        <div>
                            <div className="stat-head">
                                <span className="stat-label">Library Completion</span>
                            </div>
                            <h4 className="stat-value stat-value--sm">
                                {stats.completed} Completed
                            </h4>
                            <div className="stat-note">
                                <span className="stat-em stat-em--watching">{stats.watching}</span> Active • <span className="stat-em stat-em--plan">{stats.planToWatch}</span> Backlog
                            </div>
                        </div>
                    </div>

                    {/* CARD 4: Currently Tracking Focus */}
                    <div className="stat-card stat-card--wide">
                        <div>
                            <div className="stat-head stat-head--rule">
                                <span className="stat-label">
                                    <TrendingUp size={16} /> Active Watchlist Trackers
                                </span>
                                <span className="stat-note">
                                    Current episode progression levels
                                </span>
                            </div>

                            {stats.watchingList.length > 0 ? (
                                <div className="tracker-grid">
                                    {stats.watchingList.map((item, idx) => (
                                        <div key={idx} className="tracker-item">
                                            <span className="tracker-name" title={item.title}>
                                                {item.title}
                                            </span>
                                            <span className="tracker-progress">
                                                {item.type === 'movie' ? 'Movie' : `S${item.season || 1} E${item.episode || 0}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="state-note">
                                    No watchlist titles are currently set to "Watching" status. Toggle progress to update stats.
                                </div>
                            )}
                        </div>
                        {stats.watching > 6 && (
                            <div className="stat-footnote">
                                + {stats.watching - 6} more active titles are being tracked in your Vault.
                            </div>
                        )}
                    </div>

                    {/* CARD 5: Genre Distribution Donut Chart */}
                    {stats.genreData && stats.genreData.length > 0 && (
                        <div className="stat-card stat-card--wide">
                            <div>
                                <div className="stat-head stat-head--rule">
                                    <span className="stat-label">
                                        Genre Distribution
                                    </span>
                                    <span className="stat-note">
                                        Breakdown of genres in your collection
                                    </span>
                                </div>

                                <div className="donut-layout">

                                    {/* SVG Donut */}
                                    <div className="donut">
                                        <svg viewBox="0 0 120 120">
                                            {(() => {
                                                const totalGenresCount = stats.genreData.reduce((acc, curr) => acc + curr.count, 0);

                                                let accumulatedPercentage = 0;
                                                const radius = 45;
                                                const strokeWidth = 10;
                                                const circumference = 2 * Math.PI * radius; // ~282.74

                                                return stats.genreData.map((data, idx) => {
                                                    const percentage = (data.count / totalGenresCount) * 100;
                                                    const strokeLength = (percentage / 100) * circumference;
                                                    const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;
                                                    accumulatedPercentage += percentage;
                                                    const color = CHART_COLORS[idx % CHART_COLORS.length];

                                                    return (
                                                        <circle
                                                            key={idx}
                                                            cx="60"
                                                            cy="60"
                                                            r={radius}
                                                            stroke={color}
                                                            strokeWidth={strokeWidth}
                                                            fill="transparent"
                                                            strokeDasharray={`${strokeLength} ${circumference}`}
                                                            strokeDashoffset={strokeOffset}
                                                            strokeLinecap="round"
                                                        />
                                                    );
                                                });
                                            })()}
                                        </svg>
                                        <div className="donut__center">
                                            <div className="donut__total">
                                                {stats.genreData.reduce((acc, curr) => acc + curr.count, 0)}
                                            </div>
                                            <div className="donut__caption">
                                                Genre tags
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chart Legend */}
                                    <div className="legend">
                                        {(() => {
                                            const totalGenresCount = stats.genreData.reduce((acc, curr) => acc + curr.count, 0);

                                            return stats.genreData.map((data, idx) => {
                                                const percentage = Math.round((data.count / totalGenresCount) * 100);
                                                const color = CHART_COLORS[idx % CHART_COLORS.length];
                                                return (
                                                    <div key={idx} className="legend-item">
                                                        <div className="legend-swatch" style={{ background: color }} />
                                                        <div className="legend-text">
                                                            <span className="legend-name" title={data.genre}>
                                                                {data.genre}
                                                            </span>
                                                            <span className="legend-meta">
                                                                {data.count} title{data.count > 1 ? 's' : ''} ({percentage}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Stats;
