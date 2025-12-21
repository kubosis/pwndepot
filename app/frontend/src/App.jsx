import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";

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
import ChallengePage from "./components/challengespage";
import Contact from "./components/Contact";
import DemoBanner from "./components/DemoBanner";
import CaptainPanel from "./components/CaptainPanel";
import MfaVerify from "./components/MfaVerify";
import MfaSetup from "./components/MfaSetup";
import VerifyEmail from "./components/VerifyEmail";

import { api } from "./config/api";
import { DEMO_MODE } from "./config/demo";
import { getCookie, setCookie } from "./utils/cookies";

if (import.meta.env.PROD && DEMO_MODE) {
  // console.error("Demo mode should not run in production");
}

function AppContent() {
  const location = useLocation();

  const [showBanner, setShowBanner] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [ctfActive, setCtfActive] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Protected user route
  const ProtectedRoute = ({ children }) => {
    if (authLoading) return <p>Loading...</p>;
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
      } catch {}
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
      .catch(() => {
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
  const AdminRoute = ({ children }) => {
    if (authLoading) return <p>Checking authentication...</p>;
    if (!loggedInUser) return <Navigate to="/" replace />;
    if (loggedInUser.role !== "admin") return <Navigate to="/" replace />;
    return children;
  };

  return (
    <>
      {DEMO_MODE && <DemoBanner />}

      <Navbar
        ctfActive={ctfActive}
        loggedInUser={loggedInUser}
        setLoggedInUser={setLoggedInUser}
        onLogout={() => setLoggedInUser(null)}
      />

      {showBanner && (
        <div className="cookie-modal-overlay">
          <div className="cookie-modal">
            <p>
              We use cookies to keep you logged in. By using this site, you agree
              to our{" "}
              <a href="/privacy-policy" className="underline text-green-400">
                Privacy Policy
              </a>.
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

      <main
        className={`flex-grow pt-40 overflow-y-auto px-4 md:px-8 lg:px-16 ${
          showBanner ? "blurred" : ""
        }`}
      >
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home ctfActive={ctfActive} />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/rankings" element={<Scoreboard />} />
          <Route path="/acceptable-use-policy" element={<AcceptableUsePolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/legal-notice" element={<LegalNotice />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/challenges" element={<ChallengePage />} />
          <Route path="/join-team" element={<JoinTeam />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Auth routes */}
          <Route
            path="/register"
            element={ctfActive ? <Register /> : <Navigate to="/" replace />}
          />
          <Route
            path="/login"
            element={
              ctfActive ? (
                <Login setLoggedInUser={setLoggedInUser} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/reset-password" element={< ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <Teams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/:teamName"
            element={
              <ProtectedRoute>
                <TeamPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/profile/:username" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/captain-panel/:teamName"
            element={
              <ProtectedRoute>
                <CaptainPanel />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
            <AdminPage
            loggedInUser={loggedInUser}
            setLoggedInUser={setLoggedInUser}
            />
            }
          />

          <Route
          path="/mfa-verify"
          element={<MfaVerify setLoggedInUser={setLoggedInUser} />}
          />

          <Route
            path="/mfa/setup"
            element={
              <ProtectedRoute>
                <MfaSetup />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="mt-8 bg-[rgba(36,36,36,0.85)] backdrop-blur-md rounded-xl shadow-lg p-6 text-center text-gray-200 space-y-4 max-w-5xl mx-auto">
        <p className="font-medium text-sm text-center">
          Authors: Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan,
          Shane Samuel Pradeep and Navin Rajendran in affiliation with Institut
          supérieur d’électronique de Paris
        </p>

        <div className="legal-links flex flex-wrap justify-center gap-4 text-sm">
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

        <p className="text-xs opacity-70 leading-snug max-w-xl mx-auto">
          Recommended: Desktop or laptop (dual-core 2 GHz CPU, 4 GB RAM) with a
          modern browser and minimum 1024×768 resolution. Mobile devices are not
          supported.
        </p>

        <p className="opacity-80">
          © 2025 PwnDepot – All Rights Reserved
        </p>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
