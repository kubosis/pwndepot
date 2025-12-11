import React from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.jpg";
import "../index.css";
import { DEMO_MODE } from "../config/demo"; 
import { API_BASE_URL } from "../config/api.jsx";

export default function Navbar({ ctfActive, loggedInUser, setLoggedInUser}) {
  const navigate = useNavigate();

  const handleLogout = async () => {
  try {
    if (DEMO_MODE) {
      localStorage.removeItem("loggedInUser");
    } else {
      await fetch(`${API_BASE_URL}/api/v1/users/logout`, {
        method: "POST",
        credentials: "include",
      });
    }
  } catch (err) {
    console.warn("Logout request failed:", err);
  }

  setLoggedInUser(null);
  navigate("/");
};


  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex justify-between items-center h-16 px-6">
      {/* Left: Logo + title */}
      <div className="flex items-center">
        <Link to="/" className="navbar-logo">
          <img
            src={logo}
            alt="CTF logo"
            className="w-12 h-12 rounded-full object-cover transform transition duration-200 hover:scale-110 hover:shadow-lg"
          />
        </Link>
        <span className="navbar-header ml-2 font-semibold text-white">
          ISEP CTF Platform
        </span>
      </div>

      {/* Right: navigation buttons */}
      {ctfActive && (
        <div
          className="navbar-buttons flex items-center gap-3"
          style={{ marginRight: "0.5rem" }}
        >
          {!loggedInUser ? (
            <>
              <Link to="/Register" className="fancy-btn">
                Register
              </Link>
              <Link to="/Login" className="fancy-btn">
                Login
              </Link>
              <Link to="/Teams" className="fancy-btn">
                Teams
              </Link>
              <Link to="/Rankings" className="fancy-btn">
                Scoreboard
              </Link>
              <Link to="/Contact" className="fancy-btn">
                Contact
              </Link>
            </>
          ) : (
            <>
              <Link to="/Teams" className="fancy-btn">
                Teams
              </Link>
              <Link to="/Rankings" className="fancy-btn">
                Scoreboard
              </Link>
              <Link to="/Contact" className="fancy-btn">
                Contact
              </Link>
              <Link
                to={`/profile/${loggedInUser.username}`}
                className="fancy-btn"
              >
                My Profile
              </Link>
              {/* Logout */}
              <Link
                to="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className="fancy-btn logout-btn"
              >
                Logout
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

/*
==================== Backend Integration Notes ====================

- Frontend uses localStorage only for demo UX.
- In production:
  1) On login, backend issues an HttpOnly, Secure, SameSite=Lax cookie.
  2) Navbar (or App) should call /api/auth/status on load to confirm session.
  3) handleLogout posts /api/auth/logout to invalidate that cookie.
  4) localStorage is used only when DEMO_MODE=true.

========================================================
*/
