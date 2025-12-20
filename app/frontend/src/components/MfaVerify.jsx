import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../config/api";

export default function MfaVerify({ setLoggedInUser }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Send code to backend
      await api.post("/mfa/verify", { code });

      // 2. If successful, fetch full user profile
      const profileRes = await api.get("/users/me");

      // 3. Show success feedback
      setSuccessMessage("MFA verification successful. Logging you in...");

      // 4. Delay redirect (UX)
      setTimeout(() => {
        setLoggedInUser(profileRes.data);
        navigate("/");
      }, 1200);
      
    } catch (err) {
      console.error(err);
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Two-Factor Authentication</h2>
        <p className="text-gray-400 mb-4 text-center text-sm">
          Please enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            placeholder="000000"
            maxLength="6"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center tracking-widest text-xl"
            required
          />

          <button type="submit" disabled={loading || code.length < 6} className="enabled-animation">
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        {error && <p className="error-text fade-in">{error}</p>}
        {successMessage && <p className="success-text fade-in">{successMessage}</p>}
      </div>
    </div>
  );
}