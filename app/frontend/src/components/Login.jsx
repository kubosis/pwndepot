// src/components/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";

function Feedback({ message, type }) {
  if (!message) return null;
  return (
    <p className={`${type === "error" ? "error-text" : "success-text"} fade-in`}>
      {message}
    </p>
  );
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

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    // ======================
    // DEMO MODE
    // ======================
    if (DEMO_MODE) {
      setTimeout(() => {
        if (email === "user@example.com" && password === "123456") {
          const demoUser = {
            username: "demo_user",
            email,
            role: "user",
          };
          setLoggedInUser(demoUser);
          setSuccessMessage("Logged in successfully.");
          setLoading(false);
          setTimeout(() => navigate("/"), 800);
        } else {
          setErrorMessage("Invalid email or password.");
          setLoading(false);
        }
      }, 800);
      return;
    }

    // ======================
    // REAL BACKEND LOGIN (HttpOnly cookie)
    // ======================
    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      // Backend sets HttpOnly cookie here
      const loginRes = await api.post("/users/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (loginRes.status !== 200) {
        setErrorMessage("Invalid email or password.");
        setLoading(false);
        return;
      }

      setSuccessMessage("Login successful");

      // ======================
      // FETCH CURRENT USER
      // ======================
      const profileRes = await api.get("/users/me");
      const user = profileRes.data;

      // Block admins from user login
      if (user.role === "admin") {
        // clean up session
        await api.post("/users/logout");

        setErrorMessage("Admins must use the admin panel to log in.");
        setSuccessMessage("");
        setLoading(false);
        return;
      }

      // Normal user
      setLoggedInUser(user);
      setLoading(false);

      // small delay to show success message
      setTimeout(() => {
        navigate("/");
      }, 800);

    } catch (err) {
      console.error("Login error:", err);

      let msg = "Unable to login. Please try again.";

      if (err.response?.status === 401) msg = "Incorrect email or password.";
      if (err.response?.status === 429) msg = "Too many attempts. Slow down.";
      if (err.response?.status === 422)
        msg = err.response?.data?.detail?.[0]?.msg || "Invalid input.";

      setErrorMessage(msg);
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

          <button type="submit" disabled={loading} className="enabled-animation">
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
        <p className="mt-2 text-gray-400 text-sm">
          Forgot your password?{" "}
          <Link to="/forgotpassword" className="text-blue-400 underline">
            Reset it
          </Link>
        </p>
      </div>
    </div>
  );
}
