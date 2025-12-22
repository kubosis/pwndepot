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
  const [showResend, setShowResend] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loginPhase, setLoginPhase] = useState("idle");
  // idle | submitting | success | mfa | error

  const isBusy = loginPhase === "submitting" || loginPhase === "success";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value.trimStart() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!email || !password) {
      setLoginPhase("idle");
      setErrorMessage("Please fill out all fields.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setLoginPhase("submitting");
    setLoading(true);

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
          setLoginPhase("success");
          setSuccessMessage("Logged in successfully.");
          setLoading(false);
          setTimeout(() => navigate("/"), 1200);
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

      // --- NEW MFA CHECK ---
      if (loginRes.data.mfa_required) {
        setLoginPhase("mfa");
        setSuccessMessage("Credentials accepted. MFA required.");
        setLoading(false);
        // Redirect to the verification page
        setTimeout(() => navigate("/mfa-verify"), 1200);
        return;
      }
      // ---------------------

      if (loginRes.status !== 200) {
        setErrorMessage("Invalid email or password.");
        setLoading(false);
        return;
      }

      setLoginPhase("success");
      setSuccessMessage("Login successful");
      const meRes = await api.get("/users/me");
      setLoggedInUser(meRes.data);
      setLoading(false);

      // small delay to show success message
      setTimeout(() => {
        navigate("/");
      }, 1200);

    } catch (err) {
      console.error("Login error:", err);

      const detail = err.response?.data?.detail;

      // ADMIN BLOCK
      if (detail?.code === "ADMIN_LOGIN_FORBIDDEN") {
        setErrorMessage("Admins must use the admin panel to log in.");
        setLoading(false);
        setLoginPhase("error");
        return;
      }

      let msg = "Unable to login. Please try again.";

      if (err.response?.status === 401) {
        msg = "Incorrect email or password.";
        setShowResend(false);
      }

      if (err.response?.status === 403) {
        if (detail?.code === "EMAIL_NOT_VERIFIED") {
          setShowResend(true);
          msg = detail.message;
        } else if (detail?.code === "ACCOUNT_SUSPENDED") {
          setShowResend(false);
          msg = detail.message;
        } else {
          msg = "Login not allowed.";
        }
      }

      if (err.response?.status === 429) {
        msg = "Too many attempts. Slow down.";
      }

      setErrorMessage(msg);
      setLoginPhase("error");
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (loading) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");
      setLoading(true);

      await api.post("/users/resend-verification", {
        email: formData.email.trim(),
      });

      setSuccessMessage("Verification email sent. Please check your inbox.");
      setShowResend(false);
    } catch (err) {
      let msg = "Unable to resend verification email.";

      if (err.response?.status === 429)
        msg = "Please wait before requesting another email.";

      setErrorMessage(msg);
    } finally {
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
            disabled={isBusy}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isBusy}
          />

          <button type="submit" disabled={isBusy}>
            {loginPhase === "submitting" && "Logging in..."}
            {loginPhase === "success" && "Redirecting..."}
            {loginPhase === "idle" && "Login"}
            {loginPhase === "error" && "Login"}
          </button>
        </form>

        <Feedback message={errorMessage} type="error" />
        <Feedback message={successMessage} type="success" />

        {showResend && (
          <p
            onClick={!loading ? handleResendVerification : undefined}
            className={`mt-2 text-sm text-blue-400 underline cursor-pointer ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Didn’t get the verification email?{" "}
            <span className="font-medium">
              Resend verification email
            </span>
          </p>
        )}


        <p className="mt-3 text-gray-400 text-sm">
          Don’t have an account?{" "}
          <Link to="/register" className="text-blue-400 underline">
            Register
          </Link>
        </p>
        <p className="mt-2 text-gray-400 text-sm">
          Forgot your password?{" "}
          <Link to="/reset-password" className="text-blue-400 underline">
            Reset it
          </Link>
        </p>
      </div>
    </div>
  );
}
