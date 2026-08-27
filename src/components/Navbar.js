import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, LayoutDashboard, Search, Sparkles, BarChart3, Bell, ChevronLeft, ChevronRight, Shuffle, FolderOpen } from "lucide-react";
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
    const [readNotifications, setReadNotifications] = useState(() => {
        try {
            const saved = localStorage.getItem("read_notifications");
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem("sidebar_collapsed") === "true";
    });

    useEffect(() => {
        if (isCollapsed) {
            document.body.classList.add("sidebar-collapsed");
        } else {
            document.body.classList.remove("sidebar-collapsed");
        }
        localStorage.setItem("sidebar_collapsed", isCollapsed);
    }, [isCollapsed]);

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

    const handleMarkAsRead = (e, show) => {
        e.stopPropagation();
        const notificationKey = `${show.id}-${show.lastEpisode.season_number}-${show.lastEpisode.episode_number}`;
        const newRead = new Set(readNotifications);
        newRead.add(notificationKey);
        setReadNotifications(newRead);
        try {
            localStorage.setItem("read_notifications", JSON.stringify(Array.from(newRead)));
            toast.success("Notification dismissed");
        } catch (err) {
            console.error("Failed to save read notification to localStorage", err);
        }
    };

    const handleDismissAll = (e) => {
        e.stopPropagation();
        const newRead = new Set(readNotifications);
        activeNotifications.forEach(show => {
            const key = `${show.id}-${show.lastEpisode.season_number}-${show.lastEpisode.episode_number}`;
            newRead.add(key);
        });
        setReadNotifications(newRead);
        try {
            localStorage.setItem("read_notifications", JSON.stringify(Array.from(newRead)));
            toast.success("All notifications dismissed");
        } catch (err) {
            console.error("Failed to save read notifications to localStorage", err);
        }
    };

    const handleMarkAllWatched = async (e) => {
        e.stopPropagation();
        const loadingToast = toast.loading("Updating progress for all shows...");
        try {
            const promises = activeNotifications.map(show => 
                updateVaultItemProgress(show.id, show.lastEpisode.season_number, show.lastEpisode.episode_number)
            );
            const results = await Promise.all(promises);
            const failedCount = results.filter(res => !res.success).length;
            
            if (failedCount === 0) {
                toast.success("All shows updated successfully!", { id: loadingToast });
            } else {
                toast.error(`Updated progress, but failed for ${failedCount} show(s).`, { id: loadingToast });
            }
        } catch (err) {
            console.error("Error updating progress for all shows:", err);
            toast.error("Failed to update progress for all shows", { id: loadingToast });
        }
    };

    const activeNotifications = notifications.filter(show => {
        const key = `${show.id}-${show.lastEpisode.season_number}-${show.lastEpisode.episode_number}`;
        return !readNotifications.has(key);
    });

    return (
        <>
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <Link to="/" className="nav-brand">
                        WatchVault
                    </Link>
                </div>
                <div className="sidebar-links">
                    <Link 
                        to="/" 
                        className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
                    >
                        <Search size={20} />
                        <span className="sidebar-text">Search</span>
                    </Link>
                    {currentUser && (
                        <>
                            <Link 
                                to="/vault" 
                                className={`sidebar-link ${location.pathname === '/vault' ? 'active' : ''}`}
                            >
                                <LayoutDashboard size={20} />
                                <span className="sidebar-text">My Vault</span>
                            </Link>
                            <Link 
                                to="/recommendations" 
                                className={`sidebar-link ${location.pathname === '/recommendations' ? 'active' : ''}`}
                            >
                                <Sparkles size={20} />
                                <span className="sidebar-text">Discover</span>
                            </Link>
                            <Link 
                                to="/stats" 
                                className={`sidebar-link ${location.pathname === '/stats' ? 'active' : ''}`}
                            >
                                <BarChart3 size={20} />
                                <span className="sidebar-text">Stats</span>
                            </Link>
                            <Link 
                                to="/shuffle" 
                                className={`sidebar-link ${location.pathname === '/shuffle' ? 'active' : ''}`}
                            >
                                <Shuffle size={20} />
                                <span className="sidebar-text">Shuffle</span>
                            </Link>
                            <Link 
                                to="/categories" 
                                className={`sidebar-link ${location.pathname === '/categories' ? 'active' : ''}`}
                            >
                                <FolderOpen size={20} />
                                <span className="sidebar-text">Categories</span>
                            </Link>
                        </>
                    )}
                </div>
                <button 
                    className="sidebar-toggle-btn" 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </aside>

            {/* Top Header Panel */}
            <header className="top-header">
                <div className="header-mobile-brand">
                    <Link to="/" className="nav-brand">
                        WatchVault
                    </Link>
                </div>

                <div className="header-actions">
                    {!isOnline && (
                        <span className="badge-offline">Offline</span>
                    )}

                    {currentUser ? (
                        <>
                            {/* Notification Bell */}
                            <div className="notifications-wrapper" ref={dropdownRef}>
                                <button
                                    className={`notification-bell-btn${showDropdown ? ' notification-bell-btn--open' : ''}`}
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    title="Notifications"
                                    aria-label="Notifications"
                                >
                                    <Bell size={20} />
                                    {activeNotifications.length > 0 && (
                                        <span className="notification-badge">
                                            {activeNotifications.length}
                                        </span>
                                    )}
                                </button>

                                {showDropdown && (
                                    <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                                        <div className="notification-header">
                                            <div className="notification-header__row">
                                                <h3>Notifications</h3>
                                                <span className="notification-header__count">
                                                    {activeNotifications.length} New Releases
                                                </span>
                                            </div>
                                            {activeNotifications.length > 0 && (
                                                <div className="notification-header__actions">
                                                    <button
                                                        className="btn btn--soft btn--xs btn--flex"
                                                        onClick={handleMarkAllWatched}
                                                    >
                                                        Mark All Watched
                                                    </button>
                                                    <button
                                                        className="btn btn--ghost btn--xs btn--flex"
                                                        onClick={handleDismissAll}
                                                    >
                                                        Dismiss All
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {activeNotifications.length === 0 ? (
                                            <div className="notification-empty">
                                                No new episodes. You're all caught up!
                                            </div>
                                        ) : (
                                            <div className="notification-list">
                                                {activeNotifications.map(show => {
                                                    const notifPoster = show.poster
                                                        ? (show.poster.startsWith("http://") || show.poster.startsWith("https://")
                                                            ? show.poster
                                                            : `https://image.tmdb.org/t/p/w92${show.poster}`)
                                                        : null;

                                                    return (
                                                        <div
                                                            key={show.id}
                                                            className="notification-item"
                                                            onClick={() => {
                                                                setShowDropdown(false);
                                                            }}
                                                        >
                                                            {notifPoster ? (
                                                                <img
                                                                    src={notifPoster}
                                                                    alt={show.title}
                                                                    className="notification-poster"
                                                                />
                                                            ) : (
                                                                <div className="notification-poster poster-ph">No Poster</div>
                                                            )}
                                                            <div className="notification-content">
                                                                <div className="notification-title">{show.title}</div>
                                                                <div className="notification-text">
                                                                    S{show.lastEpisode.season_number} E{show.lastEpisode.episode_number} is out!
                                                                </div>
                                                                <div className="notification-actions">
                                                                    <button
                                                                        className="btn btn--soft btn--xs btn--flex"
                                                                        onClick={(e) => handleMarkEpisodeWatched(e, show)}
                                                                    >
                                                                        Mark Watched
                                                                    </button>
                                                                    <button
                                                                        className="btn btn--ghost btn--xs btn--flex"
                                                                        onClick={(e) => handleMarkAsRead(e, show)}
                                                                    >
                                                                        Dismiss
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button onClick={logout} className="btn btn--outline btn--sm">
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn btn--sm">
                            Login
                        </Link>
                    )}
                </div>
            </header>
        </>
    );
}

export default Navbar;
