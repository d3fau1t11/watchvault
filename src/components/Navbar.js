import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LogOut,
  LayoutDashboard,
  Search,
  Sparkles,
  BarChart3,
  Bell,
  ChevronRight,
  Shuffle,
  FolderOpen,
  User,
  Compass,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useVault } from "../context/VaultContext";
import { subscribeNotifications, checkUserNotifications, markNotificationsRead } from "../services/notificationService";
import toast from "react-hot-toast";

function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { vaultItems } = useVault();
  const [notifications, setNotifications] = useState([]);
  const [notificationOwner, setNotificationOwner] = useState(null);
  const [notificationError, setNotificationError] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("unread");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "true"; }
    catch { return false; }
  });

  const navigation = [
    { to: "/", label: "Discover", icon: Compass },
    { to: "/vault", label: "My Vault", icon: LayoutDashboard },
    { to: "/recommendations", label: "For you", icon: Sparkles },
    { to: "/categories", label: "Browse genres", icon: FolderOpen },
    { to: "/shuffle", label: "Shuffle", icon: Shuffle },
    { to: "/stats", label: "My statistics", icon: BarChart3 },
    { to: "/profile", label: "My profile", icon: User },
  ];
  const pageLabel = navigation.find(item => item.to === location.pathname)?.label || "Your account";

  useEffect(() => {
    setShowDropdown(false);
    document.title = `${pageLabel} · WatchVault`;
  }, [location.pathname, pageLabel]);

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add("sidebar-collapsed");
    } else {
      document.body.classList.remove("sidebar-collapsed");
    }
    try { localStorage.setItem("sidebar_collapsed", isCollapsed); } catch { /* Navigation works even when browser storage is unavailable. */ }
    return () => document.body.classList.remove('sidebar-collapsed');
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

  // A private subscription replaces the previous account's inbox on sign-in changes.
  useEffect(() => {
    const uid = currentUser?.uid;
    setNotifications([]);
    setNotificationOwner(uid || null);
    setNotificationError("");
    setNotificationBusy(false);
    setShowDropdown(false);
    if (!uid) return;
    let active = true;
    const unsubscribe = subscribeNotifications(uid, items => {
      if (active) { setNotifications(items.filter(item => item.userId === uid)); setNotificationError(""); }
    }, () => { if (active) setNotificationError("Your notifications could not sync. Please check your connection and try again."); });
    return () => { active = false; unsubscribe(); };
  }, [currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !vaultItems.length) return;
    let active = true;
    const timeout = setTimeout(() => {
      checkUserNotifications(uid, vaultItems, () => active).catch(() => {
        if (active) setNotificationError("Some new releases could not be checked. Saved notifications are still available.");
      });
    }, 1200);
    return () => { active = false; clearTimeout(timeout); };
  }, [currentUser?.uid, vaultItems]);

  const ownedNotifications = notificationOwner === currentUser?.uid ? notifications : [];
  const activeNotifications = ownedNotifications.filter(notification => !notification.read);
  const visibleNotifications = notificationFilter === 'all' ? ownedNotifications : activeNotifications;

  const saveReadAction = async (ids, action) => {
    const uid = currentUser?.uid;
    if (!uid || notificationBusy) return;
    setNotificationBusy(true);
    try {
      await markNotificationsRead(uid, ids, action);
      toast.success(action === 'mark_all_read' ? 'All notifications marked as read' : 'Notification marked as read');
    } catch { toast.error('The read action could not be saved. Please try again.'); }
    finally { setNotificationBusy(false); }
  };
  const handleMarkAsRead = (event, notification) => {
    event.stopPropagation();
    saveReadAction([notification.id], 'mark_read');
  };
  const handleDismissAll = event => {
    event.stopPropagation();
    saveReadAction(activeNotifications.map(notification => notification.id), 'mark_all_read');
  };

  return (
    <>
      {/* Sidebar Navigation */}
      <aside className="sidebar" id="site-navigation">
        <div className="sidebar-header">
          <Link to="/" className="nav-brand" aria-label="WatchVault home">
            <span className="brand-mark"><img src="/favicon.svg" alt="" width="34" height="34" /></span>
            <span className="brand-wordmark">watch<span>vault</span><i /></span>
          </Link>
        </div>
        <span className="nav-section-label">YOUR WATCH SPACE</span>
        <nav className="sidebar-links" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} title={label}
              aria-current={location.pathname === to ? "page" : undefined}
              className={`sidebar-link ${location.pathname === to ? "active" : ""}`}>
              <Icon size={19} strokeWidth={1.7} />
              <span className="sidebar-text">{label}</span>
              {to === "/vault" && vaultItems.length > 0 && <span className="nav-count">{vaultItems.length}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note__icon"><Sparkles size={20} /></span>
            <h3>A little less scrolling.<br />A lot more watching.</h3>
            <p>Your next favorite is out there.</p>
            <Link to="/shuffle">Find my next watch <ArrowUpRight size={15} /></Link>
          </div>
          <Link to={currentUser ? "/profile" : "/login"} className="sidebar-account">
            <span className="account-avatar">{currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)?.toUpperCase() || <User size={17} />}</span>
            <span className="sidebar-text"><strong>{currentUser?.displayName || "Your watch space"}</strong><small>{currentUser ? "Manage your account" : "Sign in to make it yours"}</small></span>
            <ChevronRight size={15} />
          </Link>
        </div>
      </aside>

      {/* Top Header Panel */}
      <header className="top-header">
        <button type="button" className="navigation-toggle" onClick={() => setIsCollapsed(collapsed => !collapsed)} title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!isCollapsed} aria-controls="site-navigation">
          {isCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <div className="header-mobile-brand">
          <Link to="/" className="nav-brand">
            <span className="brand-mark"><img src="/favicon.svg" alt="" width="30" height="30" /></span>
            <span className="brand-wordmark">watch<span>vault</span><i /></span>
          </Link>
        </div>

        <div className="header-breadcrumb"><span>Your watch space</span><ChevronRight size={13} /><strong>{pageLabel}</strong></div>
        <Link className="header-search-link" to="/#discover-search"><Search size={17} /><span>Find your next favorite</span><span className="search-link-arrow">↗</span></Link>

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
                  aria-expanded={showDropdown}
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
                      <div className="notification-filter" role="group" aria-label="Notification view">
                        <button className={`chip${notificationFilter === 'unread' ? ' chip--active' : ''}`} aria-pressed={notificationFilter === 'unread'} onClick={() => setNotificationFilter('unread')}>Unread</button>
                        <button className={`chip${notificationFilter === 'all' ? ' chip--active' : ''}`} aria-pressed={notificationFilter === 'all'} onClick={() => setNotificationFilter('all')}>All notifications</button>
                      </div>
                      {activeNotifications.length > 0 && (
                        <div className="notification-header__actions">
                          <button
                            className="btn btn--ghost btn--xs btn--flex"
                            onClick={handleDismissAll}
                            disabled={notificationBusy}
                          >
                            Mark all read
                          </button>
                        </div>
                      )}
                    </div>
                    {notificationError && <div className="notification-error" role="alert">{notificationError}</div>}
                    {visibleNotifications.length === 0 ? (
                      <div className="notification-empty">
                        No new seasons or franchise releases.
                      </div>
                    ) : (
                      <div className="notification-list">
                        {visibleNotifications.map((notif) => {
                          const notifPoster = notif.poster
                            ? (notif.poster.startsWith("http://") || notif.poster.startsWith("https://")
                              ? notif.poster
                              : `https://image.tmdb.org/t/p/w92${notif.poster}`)
                            : null;

                          return (
                            <div
                              key={notif.id}
                              className={`notification-item${notif.read ? ' notification-item--read' : ''}`}
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
                                  {notif.read ? <span className="notification-read-label">Read</span> : <button
                                    className="btn btn--ghost btn--xs btn--flex"
                                    onClick={(e) => handleMarkAsRead(e, notif)}
                                    disabled={notificationBusy}
                                  >
                                    Mark read
                                  </button>}
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

              <button onClick={logout} className="btn btn--outline btn--sm header-logout">
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn--sm">
              Sign in <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}

export default Navbar;
