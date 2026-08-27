import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
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

function App() {
    return (
        <AuthProvider>
            <VaultProvider>
                <Router>
                    <div className="App">
                        <Toaster
                            position="bottom-right"
                            toastOptions={{
                                style: {
                                    background: '#14141A',
                                    color: '#F5F5F7',
                                    border: '1px solid #33333F',
                                    borderRadius: '10px',
                                    fontSize: '0.9375rem'
                                }
                            }}
                        />
                        <Navbar />
                        <div className="main-content-layout">
                            <Suspense fallback={
                                <div className="loading-state">
                                    <div className="spinner" />
                                    <span className="loading-state__label">Loading page…</span>
                                </div>
                            }>
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/vault" element={<Vault />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/recommendations" element={<Recommendations />} />
                                    <Route path="/stats" element={<Stats />} />
                                    <Route path="/shuffle" element={<Shuffle />} />
                                    <Route path="/categories" element={<Categories />} />
                                </Routes>
                            </Suspense>
                        </div>
                </div>
            </Router>
            </VaultProvider>
        </AuthProvider>
    );
}

export default App;