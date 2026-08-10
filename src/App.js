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
                                    background: '#1a0000',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(229, 9, 20, 0.3)'
                                }
                            }} 
                        />
                        <Navbar />
                    <Suspense fallback={
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '80vh',
                            flexDirection: 'column',
                            color: 'var(--text-secondary)'
                        }}>
                            <style>{`
                                @keyframes appSpin {
                                    to { transform: rotate(360deg); }
                                }
                            `}</style>
                            <div style={{
                                width: "40px",
                                height: "40px",
                                border: "3px solid rgba(229, 9, 20, 0.1)",
                                borderTopColor: "var(--accent-primary)",
                                borderRadius: "50%",
                                marginBottom: "20px",
                                animation: "appSpin 0.8s linear infinite"
                            }}></div>
                            <h3>Loading Page...</h3>
                        </div>
                    }>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/vault" element={<Vault />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/recommendations" element={<Recommendations />} />
                            <Route path="/stats" element={<Stats />} />
                        </Routes>
                    </Suspense>
                </div>
            </Router>
            </VaultProvider>
        </AuthProvider>
    );
}

export default App;