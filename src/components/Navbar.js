import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LogOut,
  LayoutDashboard,
  Search,
  Sparkles,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  FolderOpen,
  User,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useVault } from "../context/VaultContext";
import { getTVDetailsWithAiring, getMediaDetails, getCollection } from "../services/tmdbApi";
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

  // Notifications: new seasons for TV/Anime in vault, and new movies in
  // collections/franchises the user already owns a movie from.
  useEffect(() => {
    const checkNotifications = async () => {
      if (!currentUser || !vaultItems || vaultItems.length === 0) {
        setNotifications([]);
        return;
      }

      const tvShows = vaultItems.filter(
        item => (item.type === "tv" || item.type === "anime")
      );
      const movies = vaultItems.filter(item => item.type === "movie");

      const newNotifications = [];

      // --- New seasons for TV/Anime ---
      const seasonBaseline = JSON.parse(
        localStorage.getItem("vault_season_baseline") || "{}"
      );

      for (const show of tvShows) {
        try {
          const details = await getTVDetailsWithAiring(show.tmdbId);
          if (!details) continue;

          const tmdbSeasonCount = (details.seasons || [])
            .filter(s => s.season_number > 0).length;
          const knownBaseline = seasonBaseline[show.tmdbId] || 0;

          if (tmdbSeasonCount > knownBaseline && knownBaseline > 0) {
            newNotifications.push({
              id: `new-season-${show.tmdbId}`,
              type: "new-season",
              title: show.title,
              tmdbId: show.tmdbId,
              poster: show.poster,
              newSeasons: tmdbSeasonCount - knownBaseline,
              totalSeasons: tmdbSeasonCount,
            });
          }

          // Persist the latest known season count as baseline
          if (!seasonBaseline[show.tmdbId] || tmdbSeasonCount > seasonBaseline[show.tmdbId]) {
            seasonBaseline[show.tmdbId] = tmdbSeasonCount;
          }
        } catch (err) {
          console.error("Failed to check new seasons for", show.title, err);
        }
      }

      try {
        localStorage.setItem("vault_season_baseline", JSON.stringify(seasonBaseline));
      } catch (e) {
        console.error("Failed to persist season baseline", e);
      }

      // --- New movies in collections/franchises ---
      for (const movie of movies) {
        try {
          const details = await getMediaDetails(movie.tmdbId, "movie");
          if (!details || !details.belongs_to_collection) continue;

          const collectionId = details.belongs_to_collection.id;
          const collection = await getCollection(collectionId);
          if (!collection || !collection.parts) continue;

          const addedAt = movie.createdAt?.toDate
            ? movie.createdAt.toDate()
            : new Date();

          // If any movie in the collection was released after this item was
          // added to the vault, it's a new franchise release.
          const newFranchiseMovie = collection.parts.find((part) => {
            if (!part.release_date) return false;
            const releaseDate = new Date(part.release_date);
            return releaseDate > addedAt;
          });

          if (newFranchiseMovie) {
            newNotifications.push({
              id: `franchise-${movie.tmdbId}`,
              type: "franchise",
              title: movie.title,
              tmdbId: movie.tmdbId,
              poster: movie.poster,
              movieTitle: newFranchiseMovie.title,
            });
          }
        } catch (err) {
          console.error("Failed to check franchise for", movie.title, err);
        }
      }

      setNotifications(newNotifications);
    };

    const timeoutId = setTimeout(() => {
      checkNotifications();
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [currentUser, vaultItems]);

  const activeNotifications = notifications.filter(
    (n) => !readNotifications.has(n.id)
  );

  const handleMarkAsRead = (e, notification) => {
    e.stopPropagation();
    const newRead = new Set(readNotifications);
    newRead.add(notification.id);
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
    activeNotifications.forEach((n) => newRead.add(n.id));
    setReadNotifications(newRead);
    try {
      localStorage.setItem("read_notifications", JSON.stringify(Array.from(newRead)));
      toast.success("All notifications dismissed");
    } catch (err) {
      console.error("Failed to save read notifications to localStorage", err);
    }
  };

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
            className={`sidebar-link ${location.pathname === "/" ? "active" : ""}`}
          >
            <Search size={20} />
            <span className="sidebar-text">Search</span>
          </Link>
          {currentUser && (
            <>
              <Link
                to="/vault"
                className={`sidebar-link ${location.pathname === "/vault" ? "active" : ""}`}
              >
                <LayoutDashboard size={20} />
                <span className="sidebar-text">My Vault</span>
              </Link>
              <Link
                to="/recommendations"
                className={`sidebar-link ${location.pathname === "/recommendations" ? "active" : ""}`}
              >
                <Sparkles size={20} />
                <span className="sidebar-text">Discover</span>
              </Link>
              <Link
                to="/stats"
                className={`sidebar-link ${location.pathname === "/stats" ? "active" : ""}`}
              >
                <BarChart3 size={20} />
                <span className="sidebar-text">Stats</span>
              </Link>
              <Link
                to="/shuffle"
                className={`sidebar-link ${location.pathname === "/shuffle" ? "active" : ""}`}
              >
                <Shuffle size={20} />
                <span className="sidebar-text">Shuffle</span>
              </Link>
              <Link
                to="/categories"
                className={`sidebar-link ${location.pathname === "/categories" ? "active" : ""}`}
              >
                <FolderOpen size={20} />
                <span className="sidebar-text">Categories</span>
              </Link>
              <Link
                to="/profile"
                className={`sidebar-link ${location.pathname === "/profile" ? "active" : ""}`}
              >
                <User size={20} />
                <span className="sidebar-text">Profile</span>
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
                  className={`notification-bell-btn${showDropdown ? " notification-bell-btn--open" : ""}`}
                  onClick={() => setShowDropdown(!showDropdown)}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {activeNotifications.length > 0 && (
                    <span className="notification-badge">{activeNotifications.length}</span>
                  )}
                </button>

                {showDropdown && (
                  <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                    <div className="notification-header">
                      <div className="notification-header__row">
                        <h3>Notifications</h3>
                        <span className="notification-header__count">
                          {activeNotifications.length} New
                        </span>
                      </div>
                      {activeNotifications.length > 0 && (
                        <div className="notification-header__actions">
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
                        No new seasons or franchise releases.
                      </div>
                    ) : (
                      <div className="notification-list">
                        {activeNotifications.map((notif) => {
                          const notifPoster = notif.poster
                            ? (notif.poster.startsWith("http://") || notif.poster.startsWith("https://")
                              ? notif.poster
                              : `https://image.tmdb.org/t/p/w92${notif.poster}`)
                            : null;

                          return (
                            <div
                              key={notif.id}
                              className="notification-item"
                              onClick={() => {
                                setShowDropdown(false);
                              }}
                            >
                              {notifPoster ? (
                                <img
                                  src={notifPoster}
                                  alt={notif.title}
                                  className="notification-poster"
                                />
                              ) : (
                                <div className="notification-poster poster-ph">No Poster</div>
                              )}
                              <div className="notification-content">
                                <div className="notification-title">{notif.title}</div>
                                <div className="notification-text">
                                  {notif.type === "new-season"
                                    ? `New season(s) available (${notif.totalSeasons} total)`
                                    : `New release in the "${notif.movieTitle}" franchise`}
                                </div>
                                <div className="notification-actions">
                                  <button
                                    className="btn btn--ghost btn--xs btn--flex"
                                    onClick={(e) => handleMarkAsRead(e, notif)}
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
