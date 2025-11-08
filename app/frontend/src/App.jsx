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
import ForgotPassword from "./components/forgotpassword";
import Profile from "./components/Profile";
import JoinTeam from "./components/JoinTeam";
import AdminPage from "./components/AdminPage";
import ChangePassword from "./components/ChangePassword";
import NotFound from "./components/NotFound";
import TeamPage from "./components/TeamPage";
import ChallengesPage from "./components/ChallengesPage";
import Contact from "./components/Contact";
import DemoBanner from "./components/DemoBanner";
import { DEMO_MODE } from "./config/demo";

if (import.meta.env.PROD && DEMO_MODE) {
  console.error("⚠️ Demo mode should not run in production!");
}


function AppContent() {
  const location = useLocation();

  // ===== STATE MANAGEMENT =====
  const [showBanner, setShowBanner] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [ctfActive, setCtfActive] = useState(true);

  // --- Restore states on load ---
  useEffect(() => {
    // ===== DEMO MODE LOGIC =====
    if (DEMO_MODE) {
      // Restore user session from localStorage
      try {
        const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (storedUser) setLoggedInUser(storedUser);
      } catch (err) {
        console.warn("Failed to parse loggedInUser from localStorage:", err);
      }

      // Restore admin session
      const adminSession = localStorage.getItem("isAdminLoggedIn") === "true";
      if (adminSession) setIsAdminLoggedIn(true);

      // Handle cookie banner visibility
      const accepted = localStorage.getItem("cookiesAccepted");
      const declined = localStorage.getItem("cookiesDeclined");
      if (!accepted && !declined && location.pathname !== "/privacy-policy") {
        setShowBanner(true);
        document.body.style.overflow = "hidden";
      } else {
        setShowBanner(false);
        document.body.style.overflow = "auto";
      }
    } else {
      // ===== PRODUCTION MODE LOGIC =====
      // In production, do not use localStorage for sessions or cookies.
      setShowBanner(false);
      document.body.style.overflow = "auto";

      // In a real build, replace this with secure fetches to backend
      // Example:
      // fetch("/api/auth/status", { credentials: "include" })
      //   .then(res => res.json())
      //   .then(data => setLoggedInUser(data.user || null))
      //   .catch(() => setLoggedInUser(null));
    }

    // --- Backend note ---
    // Replace this with a secure fetch to your backend:
    // fetch("/api/ctf-status")
    //   .then(res => res.json())
    //   .then(data => setCtfActive(data.active))
    //   .catch(() => setCtfActive(false));
  }, [location]);

  // ===== Cookie banner actions =====
  const handleAccept = () => {
    if (DEMO_MODE) {
      localStorage.setItem("cookiesAccepted", "true");
    }
    setShowBanner(false);
    document.body.style.overflow = "auto";
  };

  const handleDecline = () => {
    if (DEMO_MODE) {
      localStorage.setItem("cookiesDeclined", "true");
    }
    setShowBanner(false);
    document.body.style.overflow = "auto";
  };

  // ===== Protected AdminRoute =====
  const AdminRoute = ({ children }) =>
    isAdminLoggedIn ? children : <Navigate to="/" replace />;

  return (
    <>
      {/* Demo mode banner (only shows if DEMO_MODE=true) */}
      {DEMO_MODE && <DemoBanner />}

      <Navbar
        ctfActive={ctfActive}
        loggedInUser={loggedInUser}
        setLoggedInUser={setLoggedInUser}
      />

      {/* Cookie banner */}
      {showBanner && (
        <div className="cookie-modal-overlay">
          <div className="cookie-modal">
            <p>
              We use cookies to keep you logged in. By using this site, you
              agree to our{" "}
              <a
                href="/privacy-policy"
                className="underline text-green-400"
              >
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
          <Route path="/acceptable-use-policy" element={<AcceptableUsePolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/legal-notice" element={<LegalNotice />} />

          {/* Gameplay routes */}
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
          <Route
            path="/teams"
            element={ctfActive ? <Teams /> : <Navigate to="/" replace />}
          />
          <Route
            path="/rankings"
            element={ctfActive ? <Scoreboard /> : <Navigate to="/" replace />}
          />
          <Route
            path="/challenges"
            element={ctfActive ? <ChallengesPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/profile/:username"
            element={ctfActive ? <Profile /> : <Navigate to="/" replace />}
          />
          <Route
            path="/join-team"
            element={ctfActive ? <JoinTeam /> : <Navigate to="/" replace />}
          />
          <Route
            path="/forgotpassword"
            element={ctfActive ? <ForgotPassword /> : <Navigate to="/" replace />}
          />
          <Route
            path="/team/:teamName"
            element={ctfActive ? <TeamPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/contact"
            element={ctfActive ? <Contact /> : <Navigate to="/" replace />}
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={<AdminPage setIsAdminLoggedIn={setIsAdminLoggedIn} />}
          />
          <Route
            path="/admin/change-password/:userId"
            element={
              <AdminRoute>
                <ChangePassword isAdminLoggedIn={isAdminLoggedIn} />
              </AdminRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="mt-8 bg-[rgba(36,36,36,0.85)] backdrop-blur-md rounded-xl shadow-lg p-6 text-center text-gray-200 space-y-4 max-w-5xl mx-auto">
        <p className="font-medium text-sm text-center">
          Authors: Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan, Shane Samuel
          PRADEEP and Navin Rajendran in affiliation with Institut supérieur d’électronique
          de Paris
        </p>
        <div className="legal-links flex flex-wrap justify-center gap-4 text-sm">
          <a href="/terms-of-service" className="footer-link">Terms of Service (ToS)</a>
          <a href="/acceptable-use-policy" className="footer-link">Acceptable Use Policy (AUP)</a>
          <a href="/privacy-policy" className="footer-link">Privacy Policy</a>
          <a href="/legal-notice" className="footer-link">Legal Notice / Mentions Légales</a>
        </div>
        <p className="text-xs opacity-70 leading-snug max-w-xl mx-auto">
          Recommended: Desktop or laptop (dual-core 2 GHz CPU, 4 GB RAM) with a modern
          browser (Chrome, Firefox, Edge, Safari) and minimum 1024×768 resolution.
          Mobile devices are not supported.
        </p>
        <p className="opacity-80">
          © 2025 ISEP CTF Platform – All Rights Reserved
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
