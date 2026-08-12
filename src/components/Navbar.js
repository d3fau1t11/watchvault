import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, LayoutDashboard, Search, Sparkles, BarChart3, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useVault } from "../context/VaultContext";
import { getTVDetailsWithAiring } from "../services/tmdbApi";
import { updateVaultItemProgress, updateVaultItemStatus } from "../services/firestoreService";
import toast from "react-hot-toast";

function Navbar() {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { vaultItems } = useVault();
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Close notifications dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch and check for new episodes
    useEffect(() => {
        const checkNewEpisodes = async () => {
            if (!currentUser || !vaultItems || vaultItems.length === 0) {
                setNotifications([]);
                return;
            }

            const watchedShows = vaultItems.filter(item => 
                (item.type === 'tv' || item.type === 'anime') && item.status !== 'Completed'
            );

            if (watchedShows.length === 0) {
                setNotifications([]);
                return;
            }

            const newEpisodesFound = [];

            for (const show of watchedShows) {
                try {
                    const details = await getTVDetailsWithAiring(show.tmdbId);
                    if (details) {
                        const isEndedOrCanceled = details.status === 'Ended' || details.status === 'Canceled';
                        const nonZeroSeasons = details.seasons?.filter(s => s.season_number > 0) || [];
                        const lastSeasonObj = nonZeroSeasons[nonZeroSeasons.length - 1];
                        
                        const userSeason = show.season || 1;
                        const userEpisode = show.episode || 0;

                        if (isEndedOrCanceled && lastSeasonObj) {
                            const isCompleted = (userSeason > lastSeasonObj.season_number) || 
                                                (userSeason === lastSeasonObj.season_number && userEpisode >= lastSeasonObj.episode_count);
                            if (isCompleted) {
                                await updateVaultItemStatus(show.id, 'Completed');
                                toast.success(`"${show.title}" automatically marked as Completed!`);
                                continue;
                            }
                        }

                        if (show.status === 'Watching' && details.last_episode_to_air) {
                            const lastEp = details.last_episode_to_air;
                            const hasNewEp = (lastEp.season_number > userSeason) || 
                                             (lastEp.season_number === userSeason && lastEp.episode_number > userEpisode);

                            if (hasNewEp) {
                                newEpisodesFound.push({
                                    ...show,
                                    lastEpisode: lastEp
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to check new episodes for", show.title, err);
                }
            }

            setNotifications(newEpisodesFound);
        };

        const timeoutId = setTimeout(() => {
            checkNewEpisodes();
        }, 1200);

        return () => clearTimeout(timeoutId);
    }, [currentUser, vaultItems]);

    const handleMarkEpisodeWatched = async (e, show) => {
        e.stopPropagation();
        const loadingToast = toast.loading(`Saving progress...`);
        const response = await updateVaultItemProgress(show.id, show.lastEpisode.season_number, show.lastEpisode.episode_number);
        if (response.success) {
            toast.success(`Progress saved: S${show.lastEpisode.season_number} E${show.lastEpisode.episode_number}`, { id: loadingToast });
        } else {
            toast.error("Failed to update progress.", { id: loadingToast });
        }
    };

    return (
        <nav className="navbar">
            <div className="container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Link to="/" className="nav-brand">
                        WatchVault
                    </Link>
                    {!isOnline && (
                        <span style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                        }}>
                            Offline Mode
                        </span>
                    )}
                </div>
                <div className="nav-links">
                    <Link 
                        to="/" 
                        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                    >
                        <Search size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Search
                    </Link>
                    {currentUser ? (
                        <>
                            <Link 
                                to="/vault" 
                                className={`nav-link ${location.pathname === '/vault' ? 'active' : ''}`}
                            >
                                <LayoutDashboard size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                My Vault
                            </Link>
                            <Link 
                                to="/recommendations" 
                                className={`nav-link ${location.pathname === '/recommendations' ? 'active' : ''}`}
                            >
                                <Sparkles size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Discover
                            </Link>
                            <Link 
                                to="/stats" 
                                className={`nav-link ${location.pathname === '/stats' ? 'active' : ''}`}
                            >
                                <BarChart3 size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Stats
                            </Link>
                            
                            {/* Notification Bell */}
                            <div className="notifications-wrapper" ref={dropdownRef}>
                                <button 
                                    className="notification-bell-btn" 
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    title="Notifications"
                                    style={{ color: showDropdown ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Bell size={18} style={{ verticalAlign: 'middle' }} />
                                    {notifications.length > 0 && (
                                        <span className="notification-badge">
                                            {notifications.length}
                                        </span>
                                    )}
                                </button>
                                
                                {showDropdown && (
                                    <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                                        <div className="notification-header">
                                            <h3>Notifications</h3>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                {notifications.length} New Releases
                                            </span>
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                No new episodes. You're all caught up!
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {notifications.map(show => (
                                                    <div 
                                                        key={show.id} 
                                                        className="notification-item"
                                                        onClick={() => {
                                                            setShowDropdown(false);
                                                            // We could open details modal, or navigate
                                                        }}
                                                    >
                                                        <img 
                                                            src={show.poster ? (show.poster.startsWith("http://") || show.poster.startsWith("https://") ? show.poster : `https://image.tmdb.org/t/p/w92${show.poster}`) : 'https://via.placeholder.com/45x65?text=No+Poster'} 
                                                            alt={show.title} 
                                                            className="notification-poster"
                                                        />
                                                        <div className="notification-content">
                                                            <div className="notification-title">{show.title}</div>
                                                            <div className="notification-text">
                                                                S{show.lastEpisode.season_number} E{show.lastEpisode.episode_number} is out!
                                                            </div>
                                                            <button 
                                                                className="notification-action-btn"
                                                                onClick={(e) => handleMarkEpisodeWatched(e, show)}
                                                            >
                                                                Mark S{show.lastEpisode.season_number}E{show.lastEpisode.episode_number} Watched
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button onClick={logout} className="btn btn-outline" style={{ padding: '6px 12px' }}>
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn" style={{ padding: '6px 16px' }}>
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
