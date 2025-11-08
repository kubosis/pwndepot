import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hashPassword } from "../utils/passwordUtils";
import { DEMO_MODE } from "../config/demo";

function Feedback({ message, type }) {
  if (!message) return null;
  const className = type === "error" ? "error-text fade-in" : "success-text fade-in";
  return <p className={className}>{message}</p>;
}

export default function Login({ setLoggedInUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

    const hashedPassword = await hashPassword(password);
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    // ===== DEMO MODE =====
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

    // ===== PRODUCTION MODE =====
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ensures session cookie is sent
        body: JSON.stringify({ email, password: hashedPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Example backend response: { success: true, user: { username, role } }
      setLoggedInUser(data.user);
      setSuccessMessage("Logged in successfully!");
      setLoading(false);

      // MFA check if backend indicates it’s required
      if (data.requiresMFA) {
        navigate("/mfa-verify");
      } else {
        navigate("/");
      }

    } catch (err) {
      console.error("Login failed:", err);
      setErrorMessage("Server error. Please try again later.");
      setLoading(false);
    }
  };

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
          <button type="submit" className="enabled-animation" disabled={loading}>
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

// ===== TODO for backend integration =====
// 1. Add MFA verification page (/mfa-verify) after successful login if backend returns requiresMFA=true.
// 2. Backend must set secure session cookies (HttpOnly, Secure, SameSite=Lax).
// 3. Backend must issue short-lived sessions and require re-auth on expiry.
// 4. Never store credentials, tokens, or roles in localStorage when DEMO_MODE=false.
