import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Register from "./components/Register";
import Login from "./components/Login";
import Teams from "./components/Teams";
import Scoreboard from "./components/Rankings";
import TermsOfService from "./components/TermsOfService";
import AcceptableUsePolicy from "./components/AcceptableUsePolicy";
import PrivacyPolicy from "./components/PrivacyPolicy";
import LegalNotice from "./components/LegalNotice";
import ResetPassword from "./components/ResetPassword";
import Profile from "./components/Profile";
import JoinTeam from "./components/JoinTeam";
import AdminPage from "./components/AdminPage";
import NotFound from "./components/NotFound";
import TeamPage from "./components/TeamPage";
import ChallengesPage from "./components/ChallengesPage";
import Contact from "./components/Contact";
import DemoBanner from "./components/DemoBanner";
import CaptainPanel from "./components/CaptainPanel";
import MfaVerify from "./components/MfaVerify";
import MfaSetup from "./components/MfaSetup";
import VerifyEmail from "./components/VerifyEmail";
import MfaReset from "./components/MfaReset";
import ReadMore from "./components/ReadMore";
import AccountDelete from "./components/AccountDelete";

import { api } from "./config/api";
import { DEMO_MODE } from "./config/demo";
import { getCookie, setCookie } from "./utils/cookies";

if (import.meta.env.PROD && DEMO_MODE) {
  // console.error("Demo mode should not run in production");
}

const PUBLIC_ALWAYS_OK = new Set([
  "/",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/acceptable-use-policy",
  "/legal-notice",
  "/read-more",
  "/rankings",
]);

const PUBLIC_PREFIX_OK = ["/profile/", "/team/"];

const isPublicPath = (pathname) =>
  PUBLIC_ALWAYS_OK.has(pathname) ||
  PUBLIC_PREFIX_OK.some((p) => pathname.startsWith(p));

function FullScreenLoader({ text = "Loading…" }) {
  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.10)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-[#050a07]/55 to-[#050a07]/85" />
        <div className="absolute inset-0 bg-[#050a07]/30" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4">
        <div className="admin-feedback warn" style={{ marginTop: 40 }}>
          {text}
        </div>
      </div>
    </section>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const [showBanner, setShowBanner] = useState(false);
  const [, setIsAdminLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [ctfActive, setCtfActive] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ctfSecondsLeft, setCtfSecondsLeft] = useState(null);
  const isHome = location.pathname === "/";
  const pollRef = useRef(null);

    const inFlightRef = useRef(false);
    const cooldownUntilRef = useRef(0);

    const fetchCtfStatus = useCallback(async () => {
      if (DEMO_MODE) {
        setCtfActive(true);
        setCtfSecondsLeft(7 * 24 * 3600);
        return;
      }

      const nowMs = Date.now();
      if (nowMs < cooldownUntilRef.current) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        const res = await api.get("/ctf-status");

        const active = !!res.data?.active;
        const remaining = res.data?.remaining_seconds;

        setCtfActive(active);
        setCtfSecondsLeft(typeof remaining === "number" ? remaining : null);
      } catch (err) {
        const status = err?.response?.status;

        if (status === 429) {
          cooldownUntilRef.current = Date.now() + 8000; 
          return;
        }

        const code = err?.response?.data?.code || err?.response?.data?.detail?.code;
        if (code === "CTF_ENDED") {
          setCtfActive(false);
          setCtfSecondsLeft(0);
          return;
        }

        console.warn("Failed to fetch CTF status", err);
      } finally {
        inFlightRef.current = false;
      }
    }, []);

    
  const logout = useCallback(() => {
    setLoggedInUser(null);
    setIsAdminLoggedIn(false);

    if (DEMO_MODE) {
      localStorage.removeItem("loggedInUser");
      return;
    }

    api.post("/users/logout").catch((err) => {
      console.warn("Logout request failed:", err);
    });
  }, []);

  useEffect(() => {
    // always fetch once on mount / route change
    fetchCtfStatus();

    if (pollRef.current) clearInterval(pollRef.current);

    // never poll on admin routes
    if (location.pathname.startsWith("/admin")) {
      pollRef.current = null;
      return;
    }

    const intervalMs = 30000;

    pollRef.current = setInterval(() => {
      if (!document.hidden) fetchCtfStatus();
    }, intervalMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [fetchCtfStatus, location.pathname]);

  useEffect(() => {
    const handler = () => fetchCtfStatus();
    window.addEventListener("ctf-refresh", handler);
    return () => window.removeEventListener("ctf-refresh", handler);
  }, [fetchCtfStatus]);

  useEffect(() => {
    const handler = () => fetchCtfStatus();
    window.addEventListener("ctf-ended", handler);
    return () => window.removeEventListener("ctf-ended", handler);
  }, [fetchCtfStatus]);


  const loggedInUserRef = useRef(null);
  useEffect(() => { loggedInUserRef.current = loggedInUser; }, [loggedInUser]);

  useEffect(() => {
    const handler = async () => {
      if (window.location.pathname.startsWith("/admin")) return;

      const user = loggedInUserRef.current;
      if (!user) return;
      if (user.role === "admin") return;

      try {
        await api.post("/users/logout");
      } catch {
        try { await api.post("/users/logout/force"); } catch { /* ignore */ }
      }

      setLoggedInUser(null);
      if (window.location.pathname !== "/") navigate("/", { replace: true });
    };

    window.addEventListener("auth-logout", handler);
    return () => window.removeEventListener("auth-logout", handler);
  }, [navigate]);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (location.pathname.startsWith("/admin")) return;

    // SSE only when CTF is active
    if (ctfActive !== true) return;

    let es = null;
    let retryTimer = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;

      es = new EventSource("/api/v1/ctf-events");

      const onChange = () => window.dispatchEvent(new Event("ctf-refresh"));
      es.addEventListener("ctf_changed", onChange);

      es.onerror = () => {
        // if ctf has ended, backend returns 403 and interceptors do the refresh
        // don't retry in an infinite loop
        try { es?.close(); } catch { // intentionally ignore 
          }

        // small backoff when ctf is still active
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (!stopped && ctfActive === true) connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      try { es?.close(); } catch { // intentionally ignored
        }
    };
  }, [ctfActive, location.pathname]);


  // Protected user route
  const ProtectedRoute = ({ children }) => {
    if (authLoading) return <FullScreenLoader text="Authenticating…" />;
    if (!loggedInUser) return <Navigate to="/" replace />;
    return children;
  };

  useEffect(() => {
    const consent = getCookie("cookie_consent");

    const noBannerRoutes = [
      "/privacy-policy",
      "/terms-of-service",
      "/acceptable-use-policy",
      "/legal-notice",
    ];

    // Never show banner on legal pages
    if (noBannerRoutes.includes(location.pathname)) {
      setShowBanner(false);
      document.body.style.overflow = "auto";
      return;
    }

    if (!consent) {
      setShowBanner(true);
      document.body.style.overflow = "hidden";
    }
  }, [location.pathname]);


  // Initial authentication check
  useEffect(() => {
    if (DEMO_MODE) {
      try {
        const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (storedUser) {
          setLoggedInUser(storedUser);
          if (storedUser.role === "admin") {
            setIsAdminLoggedIn(true);
          }
        }
      } catch { // intentionally ignored 
        }
      setAuthLoading(false);
      return;
    }

    api.get("/users/me")
      .then((res) => {
        setLoggedInUser(res.data);
        if (res.data?.role === "admin") {
          setIsAdminLoggedIn(true);
        }
      })
      .catch((err) => {
        const code = err.response?.data?.detail?.code;

        if (code === "MFA_REQUIRED") {
          return;
        }

        setLoggedInUser(null);
        setIsAdminLoggedIn(false);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // Admin login / logout events
  useEffect(() => {
    const loginHandler = (e) => {
      const user = e.detail;
      setLoggedInUser(user);
      if (user?.role === "admin") {
        setIsAdminLoggedIn(true);
      }
    };

    const logoutHandler = () => {
      setLoggedInUser(null);
      setIsAdminLoggedIn(false);
    };

    window.addEventListener("admin-login", loginHandler);
    window.addEventListener("admin-logout", logoutHandler);

    return () => {
      window.removeEventListener("admin-login", loginHandler);
      window.removeEventListener("admin-logout", logoutHandler);
    };
  }, []);

  // Cookie banner handlers
  const handleAccept = () => {
    setCookie("cookie_consent", "minimal", 365);
    setShowBanner(false);
    document.body.style.overflow = "auto";
  };


  const handleDecline = () => {
    setCookie("cookie_consent", "declined", 365);
    setShowBanner(false);
    document.body.style.overflow = "auto";
  };

  // useEffect(() => {
  //   const consent = getCookie("cookie_consent");

  //   if (consent === "all") {
  //     loadAnalytics(); // Google Analytics / Plausible
  //   }
  // }, []); this is example cookie setting for optional future use

  // Admin-only route

  // Single source of truth: auto logout + redirect when CTF is closed (users only)

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    if (ctfActive === null) return;

    if (loggedInUser && loggedInUser.role !== "admin" && ctfActive === false) {
      logout();

      const pathname = location.pathname;
      const isPublic = isPublicPath(pathname);

      if (!isPublic) {
        navigate("/", { replace: true });
      }
      }
    }, [ctfActive, loggedInUser, logout, navigate, location.pathname]);


  const CtfGate = ({ children }) => {
    if (ctfActive === null) {
      return (
        <div className="relative min-h-[60vh]">
          {/* blurred content placeholder */}
          <div className="opacity-40 pointer-events-none">
            {children}
          </div>

          {/* overlay loader */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
              <span className="text-emerald-200/70 text-sm tracking-wide">
                Synchronizing CTF status…
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (!ctfActive) {
      return <Navigate to="/" replace />;
    }

    return children;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {DEMO_MODE && <DemoBanner />}

      {/* Blur only the app behind the modal (not the modal itself) */}
      <div className={showBanner ? "blurred" : ""}>
        <Navbar
          ctfActive={ctfActive}
          loggedInUser={loggedInUser}
          onLogout={logout}
        />

        <main
          className={[
            "flex-1 min-h-0 w-full px-4 md:px-8 lg:px-16",
            isHome ? "pt-0" : (loggedInUser?.token_data?.mfa_recovery ? "pt-32" : "pt-24"),
          ].join(" ")}
        >
          <Routes>
            {/* ========================= */}
            {/* Public routes (always) */}
            {/* ========================= */}
            <Route path="/" element={<Home ctfActive={ctfActive} ctfSecondsLeft={ctfSecondsLeft} />} />
            <Route path="/rankings" element={<Scoreboard />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/acceptable-use-policy" element={<AcceptableUsePolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/legal-notice" element={<LegalNotice />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/read-more" element={<ReadMore />} />
            <Route path="/verify-email" element={<CtfGate><VerifyEmail /> </CtfGate>} />
            <Route path="/team/:teamName"element={<TeamPage /> } />
            <Route path="/profile/:username" element={<Profile loggedInUser={loggedInUser} />} />

            {/* ========================= */}
            {/* Auth routes (CTF only) */}
            {/* ========================= */}
            <Route
              path="/register"
              element={
                <CtfGate>
                  <Register />
                </CtfGate>
              }
            />

            <Route
              path="/login"
              element={
                <CtfGate>
                  <Login setLoggedInUser={setLoggedInUser} />
                </CtfGate>
              }
            />
            <Route path="/reset-password" element={<CtfGate><ResetPassword /> </CtfGate>} />

            {/* ========================= */}
            {/* CTF gameplay routes */}
            {/* ========================= */}
            <Route
              path="/challenges"
              element={
                <CtfGate>
                  <ChallengesPage />
                </CtfGate>
              }
            />
            <Route
              path="/join-team"
              element={
                <CtfGate>
                  <JoinTeam />
                </CtfGate>
              }
            />

            {/* ========================= */}
            {/* Protected user routes */}
            {/* ========================= */}
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <CtfGate>
                    <Teams />
                  </CtfGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/captain-panel/:teamName"
              element={
                <ProtectedRoute>
                  <CtfGate>
                    <CaptainPanel />
                  </CtfGate>
                </ProtectedRoute>
              }
            />

            <Route
              path="/account/delete"
              element={
                <ProtectedRoute>
                  <CtfGate>
                    {loggedInUser &&
                    (loggedInUser.role === "USER" || loggedInUser.role === "user") &&
                    !loggedInUser?.token_data?.mfa_recovery ? (
                      <AccountDelete loggedInUser={loggedInUser} 
                      setLoggedInUser={setLoggedInUser}/>
                    ) : (
                      <Navigate to="/" replace />
                    )}
                  </CtfGate>
                </ProtectedRoute>
              }
            />

            {/* ========================= */}
            {/* MFA routes */}
            {/* ========================= */}
            <Route
              path="/mfa/reset"
              element={
                <ProtectedRoute>
                  <MfaReset setLoggedInUser={setLoggedInUser} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mfa/setup"
              element={
                <ProtectedRoute>
                  <MfaSetup loggedInUser={loggedInUser} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mfa-verify"
              element={<MfaVerify setLoggedInUser={setLoggedInUser} />}
            />

            {/* ========================= */}
            {/* Admin routes (always) */}
            {/* ========================= */}
            <Route
              path="/admin"
              element={
                <AdminPage
                  loggedInUser={loggedInUser}
                  setLoggedInUser={setLoggedInUser}
                  onLogout={logout}
                  ctfActive={ctfActive}
                  ctfSecondsLeft={ctfSecondsLeft}
                />
              }
            />

            {/* ========================= */}
            {/* Fallback */}
            {/* ========================= */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="relative w-full mt-0 text-emerald-50/80">
          {/* Top separator line (matches navbar glow) */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent" />

          {/* Footer surface (transparent but readable) */}
          <div className="relative overflow-hidden">
            {/* Soft background panel */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-md" />

            {/* Subtle grid, like homepage */}
            <div
              className="absolute inset-0 opacity-[0.10] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />

            {/* Vignette to keep focus in the center */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.0)_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.65)_100%)]" />

            {/* Content */}
            <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left: authors */}
                <div className="md:col-span-7">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/60">
                    PwnDepot / Credits
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-emerald-50/80">
                    Authors: Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan,
                    Shane Samuel Pradeep and Navin Rajendran in affiliation with Institut
                    supérieur d'électronique de Paris
                  </p>

                  <p className="mt-3 text-xs text-emerald-200/55 leading-relaxed max-w-xl">
                    Recommended: Desktop or laptop (dual-core 2 GHz CPU, 4 GB RAM) with a modern
                    browser and minimum 1024×768 resolution.
                  </p>
                </div>

                {/* Right: legal links */}
                <div className="md:col-span-5 md:text-right">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/60">
                    Legal
                  </div>

                  <div className="mt-3 flex md:justify-end flex-wrap gap-x-4 gap-y-2 text-sm">
                    <a href="/terms-of-service" className="footer-link">
                      Terms of Service (ToS)
                    </a>
                    <a href="/acceptable-use-policy" className="footer-link">
                      Acceptable Use Policy (AUP)
                    </a>
                    <a href="/privacy-policy" className="footer-link">
                      Privacy Policy
                    </a>
                    <a href="/legal-notice" className="footer-link">
                      Legal Notice / Mentions Légales
                    </a>
                  </div>

                  {/* Small “status” chip for UX polish */}
                  <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100/80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(110,255,190,0.30)]" />
                    secure node • terminal ui
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-emerald-200/55">
                  © 2026 PwnDepot - All Rights Reserved
                </div>

                <div className="text-[11px] text-emerald-200/45">
                  build: public • theme: emerald-dark
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal must be outside the blurred wrapper */}
      {showBanner && (
        <div className="cookie-modal-overlay">
          <div className="cookie-modal">
            <p>
              We use cookies to keep you logged in. By using this site, you agree to
              our{" "}
              <a href="/privacy-policy" className="underline text-green-400">
                Privacy Policy
              </a>
              .
            </p>
            <div className="cookie-buttons">
              <button onClick={handleAccept} className="accept-btn">
                Accept
              </button>
              <button onClick={handleDecline} className="decline-btn">
                Refuse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
