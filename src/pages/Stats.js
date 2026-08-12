import { useMemo } from "react";
import { useVault } from "../context/VaultContext";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { BarChart3, TrendingUp, Clock, Library } from "lucide-react";

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
            watchingList: watchingList.slice(0, 6) // Display top 6 currently watching trackers
        };
    }, [vaultItems]);

    if (vaultLoading) {
        return (
            <div className="page container" style={{ textAlign: "center", padding: "100px 0" }}>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <div style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(229, 9, 20, 0.1)",
                    borderTopColor: "var(--accent-primary)",
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    animation: "spin 0.8s linear infinite"
                }}></div>
                <h3 style={{ color: "var(--text-secondary)" }}>Analyzing your Vault metrics...</h3>
            </div>
        );
    }

    return (
        <div className="page container">
            <style>{`
                @keyframes statsFadeIn {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .stats-grid-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .stats-grid-card:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.04) !important;
                    border-color: rgba(229, 9, 20, 0.2) !important;
                    box-shadow: 0 12px 24px -10px rgba(229, 9, 20, 0.25);
                }
                .stats-distribution-pill {
                    font-size: 0.72rem;
                    font-weight: 600;
                    padding: 3px 8px;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: var(--text-secondary);
                }
            `}</style>

            <div style={{ marginBottom: "30px" }}>
                <h1 className="page-title" style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #ff4b4b 0%, #b81d24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    <BarChart3 size={28} style={{ color: "var(--accent-primary)" }} /> Vault Statistics
                </h1>
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                    Deep-dive tracking analytics, format distribution metrics, and watchlist watchtime reports.
                </p>
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
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '24px',
                    animation: 'statsFadeIn 0.5s ease'
                }}>
                    {/* CARD 1: Total Library size */}
                    <div className="stats-grid-card" style={{
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        border: 'var(--glass-border)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                    }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Library</span>
                                <Library size={18} color="var(--accent-primary)" />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {stats.total} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Titles</span>
                            </h4>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
                            <span className="stats-distribution-pill">🎬 {stats.moviesCount} Movies</span>
                            <span className="stats-distribution-pill">📺 {stats.tvCount} Shows</span>
                            <span className="stats-distribution-pill">🛡️ {stats.animeCount} Anime</span>
                        </div>
                    </div>

                    {/* CARD 2: Total Hours Watched */}
                    <div className="stats-grid-card" style={{
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        border: 'var(--glass-border)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                    }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Estimated Watch Time</span>
                                <Clock size={18} color="#10b981" />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {stats.hoursWatched} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Hours</span>
                            </h4>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>★ Live computation</span> based on custom episode tracking progress.
                        </div>
                    </div>

                    {/* CARD 3: Watchlist Completion Percentage */}
                    <div className="stats-grid-card" style={{
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        border: 'var(--glass-border)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                    }}>
                        {/* Circular Progress Gauge */}
                        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                            <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                <circle cx="40" cy="40" r="34" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="6" fill="transparent" />
                                <circle cx="40" cy="40" r="34" stroke="var(--accent-primary)" strokeWidth="6" fill="transparent" 
                                    strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 * (1 - stats.completionRate / 100)}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                                {stats.completionRate}%
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Library Completion</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                {stats.completed} Completed
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                <span style={{ color: '#60a5fa', fontWeight: 600 }}>{stats.watching}</span> Active • <span style={{ color: '#fbbf24', fontWeight: 600 }}>{stats.planToWatch}</span> Backlog
                            </div>
                        </div>
                    </div>

                    {/* CARD 4: Currently Tracking Focus */}
                    <div className="stats-grid-card" style={{
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        border: 'var(--glass-border)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                        gridColumn: '1 / -1' // Span full row width for lists
                    }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingUp size={16} color="#10b981" /> Active Watchlist Trackers
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    Current episode progression levels
                                </span>
                            </div>

                            {stats.watchingList.length > 0 ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                    gap: '16px',
                                    marginTop: '12px'
                                }}>
                                    {stats.watchingList.map((item, idx) => (
                                        <div key={idx} style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.04)',
                                            borderRadius: '8px',
                                            padding: '12px 16px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={item.title}>
                                                {item.title}
                                            </span>
                                            <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(229, 9, 20, 0.08)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(229, 9, 20, 0.15)' }}>
                                                {item.type === 'movie' ? 'Movie' : `S${item.season || 1} E${item.episode || 0}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    No watchlist titles are currently set to "Watching" status. Toggle progress to update stats.
                                </div>
                            )}
                        </div>
                        {stats.watching > 6 && (
                            <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                                + {stats.watching - 6} more active titles are being tracked in your Vault.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Stats;
