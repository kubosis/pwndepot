import { useState } from "react";
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
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // 1. Send code to backend
      await api.post("/mfa/verify", { code });

      // 2. Get /users/me
      const meRes = await api.get("/users/me");

      console.log("MFA VERIFY /users/me =", meRes.data);

      // 3. Save to global state
      setLoggedInUser(meRes.data);

      // 4. Success Message
      setSuccessMessage("MFA verification successful. Logging you in...");

      // 5. Redirect
      setTimeout(() => {
        navigate("/", { replace: true });
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
            placeholder="123456 or backup code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/\s/g, "")
              )
            }
            className="text-center tracking-widest text-xl"
            autoComplete="one-time-code"
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