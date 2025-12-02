// src/components/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";
import { API_BASE_URL } from "../config/api.jsx";
import { parseJwt } from "../utils/jwt.jsx"; // must match named export

// Small helper to show success / error messages
function Feedback({ message, type }) {
  if (!message) return null;
  const className =
    type === "error" ? "error-text fade-in" : "success-text fade-in";
  return <p className={className}>{message}</p>;
}

export default function Login({ setLoggedInUser, setAuthToken }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Keep inputs controlled and trim only at the beginning
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value.trimStart() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!email || !password) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    // ======================
    // DEMO MODE (frontend-only)
    // ======================
    if (DEMO_MODE) {
      setTimeout(() => {
        if (email === "user@example.com" && password === "123456") {
          const demoUser = {
            username: "user1",
            email,
            role: "user",
          };
          localStorage.setItem("loggedInUser", JSON.stringify(demoUser));
          setLoggedInUser(demoUser);
          setSuccessMessage("Logged in successfully.");
          setLoading(false);
          setTimeout(() => navigate("/"), 800);
        } else if (email === "admin@example.com") {
          setErrorMessage("Access denied: Admins must log in via admin panel.");
          setLoading(false);
        } else {
          setErrorMessage("Invalid email or password.");
          setLoading(false);
        }
      }, 800);
      return;
    }

    // ======================
    // PRODUCTION MODE (real backend)
    // ======================
    try {
      // Backend expects application/x-www-form-urlencoded and OAuth2PasswordRequestForm
      const body = new URLSearchParams();
      body.append("username", email);        // backend treats "username" as login/email
      body.append("password", password);     // backend hashes password itself
      body.append("grant_type", "password"); // required by OAuth2PasswordRequestForm

      const res = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error("Login: cannot parse JSON response", e);
        setErrorMessage("Invalid response from server.");
        setLoading(false);
        return;
      }

      // Handle HTTP errors (401, 400, etc.)
      if (!res.ok) {
        console.error("Login failed:", data);
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
            ? data.detail[0]?.msg || "Invalid email or password."
            : "Invalid email or password.";
        setErrorMessage(detail);
        setLoading(false);
        return;
      }

      // Expected successful response: { access_token: "...", token_type: "bearer" }
      const token = data.access_token;
      if (!token) {
        console.error("Login: no access token in response", data);
        setErrorMessage("No access token returned from server.");
        setLoading(false);
        return;
      }

      // Store token in app state (parent component decides where to keep it)
      if (typeof setAuthToken === "function") {
        setAuthToken(token);
      } else {
        console.warn("setAuthToken is not a function - check props wiring");
      }

      // Decode JWT to get user id (sub)
      const payload = parseJwt(token);
      console.log("JWT payload:", payload);

      if (!payload || !payload.sub) {
        console.error("JWT payload missing 'sub':", payload);
        setErrorMessage("Invalid token payload.");
        setLoading(false);
        return;
      }

      const userId = payload.sub;

      // Fetch user profile from backend
      const profileRes = await fetch(
        `${API_BASE_URL}/api/v1/users/profile/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!profileRes.ok) {
        const errBody = await profileRes.text();
        console.error(
          "Profile request failed:",
          profileRes.status,
          errBody
        );
        setErrorMessage("Failed to load user profile.");
        setLoading(false);
        return;
      }

      let user;
      try {
        user = await profileRes.json();
      } catch (e) {
        console.error("Profile: cannot parse JSON", e);
        setErrorMessage("Invalid profile data from server.");
        setLoading(false);
        return;
      }

      console.log("Logged in user:", user);
      if (typeof setLoggedInUser === "function") {
        setLoggedInUser(user);
      }

      setSuccessMessage("Login success");
      setLoading(false);
      navigate("/");
    } catch (err) {
      // This is the path that currently sets "Server error"
      console.error("Login unexpected error:", err);
      // Show real error message during dev to see what exactly broke
      setErrorMessage(err?.message || "Server error");
      setLoading(false);
    }
  };

  // ==============
  // RENDER
  // ==============
  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Login</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            className="enabled-animation"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <Feedback message={errorMessage} type="error" />
        <Feedback message={successMessage} type="success" />

        <p className="mt-3 text-gray-400 text-sm">
          Don’t have an account?{" "}
          <Link to="/register" className="text-blue-400 underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
