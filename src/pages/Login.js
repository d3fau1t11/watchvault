import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Eye, EyeOff, Film, ListChecks, Sparkles } from "lucide-react";

function Login() {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const requestedPage = location.state?.from;
    const returnTo = typeof requestedPage === 'string' && requestedPage.startsWith('/') && !requestedPage.startsWith('//') && requestedPage !== '/login' ? requestedPage : '/vault';
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (currentUser) {
            navigate(returnTo, { replace: true });
        }
    }, [currentUser, navigate, returnTo]);

    const handleGoogleLogin = async () => {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle();
            navigate(returnTo, { replace: true });
        } catch (err) {
            setError("Failed to sign in with Google.");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        try {
            setError("");
            setLoading(true);
            if (isLogin) {
                await loginWithEmail(email, password);
            } else {
                await signupWithEmail(email, password);
            }
            navigate(returnTo, { replace: true });
        } catch (err) {
            setError(isLogin ? "Failed to log in. Check your credentials." : "Failed to create account.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container container">
            <section className="login-story">
                <span className="eyebrow"><Film size={15} /> YOUR PERSONAL WATCH SPACE</span>
                <h2>Great stories.<br />All in <span className="accent-text">one place.</span></h2>
                <p>From the first episode to the final credits, give everything you watch a place to belong.</p>
                <div className="login-benefits"><span><Bookmark />Save movies, series, and anime</span><span><ListChecks />Pick up exactly where you left off</span><span><Sparkles />Find more of what you love</span></div>
                <Link to="/" className="login-back"><ArrowLeft size={14} /> Back to discovery</Link>
            </section>
            <div className="login-card">
                <h1 className="login-title">{isLogin ? "Welcome back." : "Make it your space."}</h1>
                <p className="login-subtitle">{isLogin ? "Your next watch is waiting for you." : "Create an account and start your collection."}</p>

                {error && <div className="login-error" role="alert">{error}</div>}

                <button
                    className="btn btn--google btn--block"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt=""
                        width="18"
                        height="18"
                    />
                    Continue with Google
                </button>

                <div className="login-divider">OR</div>

                <form onSubmit={handleEmailAuth} className="login-form">
                    <div className="field"><label htmlFor="login-email" className="field-label">Email address</label>
                    <input
                        id="login-email"
                        type="email"
                        className="input"
                        placeholder="Email Address"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                    </div>
                    <div className="field"><label htmlFor="login-password" className="field-label">Password</label><div className="password-field">
                    <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        className="input"
                        placeholder="Password"
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={isLogin ? undefined : 6}
                        disabled={loading}
                    />
                    <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </div></div>
                    <button type="submit" className="btn btn--block" disabled={loading}>
                        {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
                    </button>
                </form>

                <p className="login-switch">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        className="link-btn"
                        onClick={() => { setIsLogin(!isLogin); setError(""); }}
                        disabled={loading}
                    >
                        {isLogin ? "Sign Up" : "Log In"}
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Login;
