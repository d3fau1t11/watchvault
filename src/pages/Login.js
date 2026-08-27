import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Login() {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, currentUser } = useAuth();
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            navigate("/vault");
        }
    }, [currentUser, navigate]);

    const handleGoogleLogin = async () => {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle();
            navigate("/vault");
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
            navigate("/vault");
        } catch (err) {
            setError(isLogin ? "Failed to log in. Check your credentials." : "Failed to create account.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container container">
            <div className="login-card">
                <h1 className="login-title">Welcome to WatchVault</h1>
                <p className="login-subtitle">Sign in to manage your watchlist</p>

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
                    <input
                        type="email"
                        className="input"
                        placeholder="Email Address"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        className="input"
                        placeholder="Password"
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn btn--block" disabled={loading}>
                        {isLogin ? "Log In" : "Sign Up"}
                    </button>
                </form>

                <p className="login-switch">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        className="link-btn"
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? "Sign Up" : "Log In"}
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Login;
