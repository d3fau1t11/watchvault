import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useVault } from "../context/VaultContext";
import { Navigate, useNavigate } from "react-router-dom";
import {
  LogOut,
  Mail,
  User,
  ShieldAlert,
  Trash2,
  Play,
  Image as ImageIcon,
  RefreshCw,
  Film,
  PlayCircle,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import PasswordSettings from '../components/PasswordSettings';

/* Local animated avatars also work offline and respect reduced motion. */
const ANIMATED_AVATARS = [
  {
    id: "anime-hero",
    label: "Anime Hero",
    preview:
      "/avatars/hero.svg",
    fallback: "/avatars/hero.svg",
  },
  {
    id: "anime-girl",
    label: "Anime Girl",
    preview:
      "/avatars/dreamer.svg",
    fallback: "/avatars/dreamer.svg",
  },
  {
    id: "movie-detective",
    label: "Movie Detective",
    preview:
      "/avatars/detective.svg",
    fallback: "/avatars/detective.svg",
  },
  {
    id: "movie-sci-fi",
    label: "Sci-Fi Explorer",
    preview:
      "/avatars/explorer.svg",
    fallback: "/avatars/explorer.svg",
  },
  {
    id: "movie-action",
    label: "Action Star",
    preview:
      "/avatars/action.svg",
    fallback: "/avatars/action.svg",
  },
  {
    id: "movie-horror",
    label: "Horror Fan",
    preview:
      "/avatars/ghost.svg",
    fallback: "/avatars/ghost.svg",
  },
];

function Profile() {
  const {
    currentUser,
    reauthenticate,
    reauthenticateWithPassword,
    deleteAccount,
    logout,
  } = useAuth();
  const {
    totalItems,
    watchingCount,
    completedCount,
    planToWatchCount,
  } = useVault();
  const navigate = useNavigate();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [reauthEmail, setReauthEmail] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reauthError, setReauthError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const usesGoogle = currentUser
    ? (currentUser.providerData || []).some((p) => p.providerId === "google.com")
    : false;

  /* Persist the chosen animated avatar in localStorage so it survives refreshes.
     In a production app this would be written to Firestore user metadata. */
  const savedAvatar = localStorage.getItem("watchvault_avatar") || "";
  const avatarUrl = savedAvatar || currentUser?.photoURL || "";

  const handleSelectAvatar = (avatar) => {
    localStorage.setItem("watchvault_avatar", avatar.preview);
    setShowAvatarPicker(false);
    toast.success("Avatar updated!");
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleteError("");

    try {
      setDeleting(true);

      if (usesGoogle) {
        await reauthenticate();
      } else {
        if (!reauthEmail || !reauthPassword) {
          setShowReauth(true);
          setDeleting(false);
          return;
        }
        await reauthenticateWithPassword(reauthEmail, reauthPassword);
      }

      await deleteAccount();
      toast.success("Your account has been deleted.");
      navigate("/");
    } catch (err) {
      const code = err.code || err.message || "";
      if (
        code === "auth/requires-recent-login" ||
        code === "auth/user-token-expired" ||
        err.message === "REAUTH_PASSWORD_REQUIRED"
      ) {
        setShowReauth(true);
        setDeleteError("");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setReauthError("Incorrect password. Please try again.");
      } else {
        setDeleteError(err.message || "Failed to delete account. Please try again.");
      }
      console.error("Delete account error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleReauthSubmit = async (e) => {
    e.preventDefault();
    setReauthError("");
    setShowReauth(false);
    setDeleting(true);

    try {
      const email = reauthEmail || currentUser.email;
      await reauthenticateWithPassword(email, reauthPassword);
      await deleteAccount();
      toast.success("Your account has been deleted.");
      navigate("/");
    } catch (err) {
      const code = err.code || err.message || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setReauthError("Incorrect password. Please try again.");
      } else {
        setDeleteError(err.message || "Failed to delete account. Please try again.");
      }
      setShowReauth(true);
    } finally {
      setDeleting(false);
    }
  };

  const hasPassword = currentUser?.providerData?.some(provider => provider.providerId === 'password');
  const providerLabel = usesGoogle ? (hasPassword ? 'Google + password' : 'Google') : 'Email / Password';
  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
  const email = currentUser?.email || "";

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page container profile-page">
      <div className="page-header page-header--center">
        <div className="page-heading">
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1 className="page-title">
            <User size={28} /> Your watch space.
          </h1>
          <p className="page-subtitle">
            Manage your account, vault stats, and personal avatar.
          </p>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="modal-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="modal-content avatar-picker-dialog" role="dialog" aria-modal="true" aria-label="Choose your avatar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-header__title" style={{ margin: 0, fontSize: "var(--fs-lg)" }}>Choose Your Avatar</h2>
              <p className="modal-header__subtitle" style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                Pick an animated movie character to represent your profile.
              </p>
            </div>
            <div className="avatar-picker-grid">
              {ANIMATED_AVATARS.map((avatar) => {
                const isActive = avatar.preview === avatarUrl || avatar.preview === savedAvatar;
                return (
                  <button
                    key={avatar.id}
                    className={`avatar-option ${isActive ? "avatar-option--active" : ""}`}
                    onClick={() => handleSelectAvatar(avatar)}
                    aria-label={avatar.label}
                  >
                    <div className="avatar-preview-wrap">
                      <img
                        src={avatar.preview}
                        alt={avatar.label}
                        className="avatar-preview"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = avatar.fallback;
                        }}
                        loading="lazy"
                      />
                      {isActive && (
                        <div className="avatar-check">
                          <Check size={20} />
                        </div>
                      )}
                    </div>
                    <span className="avatar-option__label">{avatar.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setShowAvatarPicker(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="profile-grid">
        {/* Account Card */}
        <div className="profile-card account-card">
          <div className="profile-card__header">
            <div className="profile-avatar-wrap">
              <div className="avatar-display">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="avatar-animated"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/avatars/explorer.svg";
                    }}
                  />
                ) : (
                  <div className="avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
                )}
                <button
                  className="avatar-edit-btn"
                  onClick={() => setShowAvatarPicker(true)}
                  title="Change avatar"
                  aria-label="Change avatar"
                >
                  <ImageIcon size={16} />
                </button>
              </div>
              <div className="profile-identity">
                <h2 className="profile-name">{displayName}</h2>
                <p className="profile-email">
                  <Mail size={14} /> <span className="profile-email__address">{email}</span>
                </p>
                <span className="profile-provider">
                  <PlayCircle size={12} /> <span>Signed in with {providerLabel}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="profile-card__body">
            <div className="profile-divider">Your Vault</div>
            <div className="stats-row">
              <div className="stat">
                <div className="stat__icon"><Film size={20} /></div>
                <div className="stat__value">{totalItems}</div>
                <div className="stat__label">Titles Saved</div>
              </div>
              <div className="stat stat--watching">
                <div className="stat__icon"><Play size={20} /></div>
                <div className="stat__value">{watchingCount}</div>
                <div className="stat__label">Watching</div>
              </div>
              <div className="stat stat--done">
                <div className="stat__icon"><Check size={20} /></div>
                <div className="stat__value">{completedCount}</div>
                <div className="stat__label">Completed</div>
              </div>
              <div className="stat stat--plan">
                <div className="stat__icon"><RefreshCw size={20} /></div>
                <div className="stat__value">{planToWatchCount}</div>
                <div className="stat__label">Plan to Watch</div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings / Danger Zone Card */}
        <div className="profile-card settings-card">
          <div className="profile-card__header">
            <h3 className="profile-card__title">Account Settings</h3>
          </div>
          <div className="profile-card__body">
            <div className="profile-section">
              <div className="profile-section__row">
                <div className="profile-section__label">Change Avatar</div>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => setShowAvatarPicker(true)}
                >
                  <ImageIcon size={16} /> Select Animated Avatar
                </button>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section__row">
                <div className="profile-section__label">Sign out</div>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>

            <PasswordSettings />
            <div className="profile-divider">Danger Zone</div>
            <div className="profile-section">
              <div className="profile-section__row">
                <div className="profile-section__label">Delete Account</div>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : <><Trash2 size={16} /> Delete Account</>}
                </button>
              </div>
              <p className="profile-section__note">
                Permanently delete your account and all saved vault data. This
                cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content profile-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete account confirmation" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <ShieldAlert size={28} className="modal-header__icon" />
              <h2 className="modal-header__title">Delete Account?</h2>
            </div>
            <p className="modal-body">
              This will permanently delete your account and all of your saved
              vault data. This action cannot be undone.
            </p>

            {showReauth && !usesGoogle && (
              <div className="reauth-card">
                <h3 className="reauth-card__title">Confirm your password</h3>
                <p className="reauth-card__subtitle">
                  For security, please re-enter your password to continue.
                </p>
                {reauthError && (
                  <div className="reauth-error" role="alert">{reauthError}</div>
                )}
                <form onSubmit={handleReauthSubmit} className="reauth-form">
                  <div className="field">
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      className="input"
                      value={reauthEmail}
                      onChange={(e) => setReauthEmail(e.target.value)}
                      placeholder="you@example.com"
                      aria-label="Confirm account email"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Password</label>
                    <input
                      type="password"
                      className="input"
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn--block"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting account…" : "Continue &amp; Delete Account"}
                  </button>
                </form>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setShowReauth(false);
                    setDeleteError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {usesGoogle && !showReauth && (
              <div className="reauth-card">
                <h3 className="reauth-card__title">Re-authenticate with Google</h3>
                <p className="reauth-card__subtitle">
                  For security, please sign in with Google again before your
                  account can be deleted.
                </p>
                <button
                  className="btn btn--block btn--google"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Re-authenticating…" : <><img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt=""
                    width="18"
                    height="18"
                  /> Continue with Google</>}
                </button>
              </div>
            )}

            {!showReauth && (
              <div className="modal-actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--danger"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete My Account"}
                </button>
              </div>
            )}

            {deleteError && (
              <div className="modal-error" role="alert">{deleteError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
