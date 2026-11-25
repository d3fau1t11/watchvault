import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { VaultProvider } from "./context/VaultContext";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";

const Home = lazy(() => import("./pages/Home"));
const Vault = lazy(() => import("./pages/Vault"));
const Login = lazy(() => import("./pages/Login"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Stats = lazy(() => import("./pages/Stats"));
const Shuffle = lazy(() => import("./pages/Shuffle"));
const Categories = lazy(() => import("./pages/Categories"));
const Profile = lazy(() => import("./pages/Profile"));

function RouteScroll() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
}

function AccountPage({ children }) {
    const { currentUser } = useAuth();
    const location = useLocation();
    return currentUser ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

function App() {
    return (
        <AuthProvider>
            <VaultProvider>
                <Router>
                    <div className="app-shell">
                        <a className="skip-link" href="#main-content">Skip to content</a>
                        <RouteScroll />
                        <Toaster
                            position="bottom-right"
                            toastOptions={{
                                style: {
                                    background: '#202125',
                                    color: '#f3f1eb',
                                    border: '1px solid #42434a',
                                    borderRadius: '12px',
                                    fontSize: '13px'
                                }
                            }}
                        />
                        <Navbar />
                        <main className="main-content-layout" id="main-content" tabIndex={-1}>
                            <Suspense fallback={
                                <div className="loading-state">
                                    <div className="spinner" />
                                    <span className="loading-state__label">Loading page…</span>
                                </div>
                            }>
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/vault" element={<AccountPage><Vault /></AccountPage>} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/recommendations" element={<AccountPage><Recommendations /></AccountPage>} />
                                    <Route path="/stats" element={<AccountPage><Stats /></AccountPage>} />
                                    <Route path="/shuffle" element={<Shuffle />} />
                                    <Route path="/categories" element={<Categories />} />
                                    <Route path="/profile" element={<AccountPage><Profile /></AccountPage>} />
                                    <Route path="*" element={<div className="page container"><div className="empty"><h1 className="empty-title">This story took a wrong turn.</h1><p className="empty-text">We couldn’t find that page. There’s plenty more to discover.</p><Link className="btn" to="/">Back to discovery</Link></div></div>} />
                                </Routes>
                            </Suspense>
                        </main>
                </div>
            </Router>
            </VaultProvider>
        </AuthProvider>
    );
}

export default App;
