// src/components/Login.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";
import { redirectIfLoggedIn } from "../utils/authRedirect";

/**
 * Consistent feedback box (error / success / warn).
 */
function Feedback({ message, type = "success" }) {
  if (!message) return null;
  return <div className={`auth-feedback ${type}`}>{message}</div>;
}

export default function Login({ setLoggedInUser }) {
  const navigate = useNavigate();
  useEffect(() => {
    redirectIfLoggedIn(navigate);
  }, [navigate]);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // idle | submitting | success | mfa | error
  const [loginPhase, setLoginPhase] = useState("idle");

  const isBusy =
    loginPhase === "submitting" || loginPhase === "success" || loginPhase === "mfa";

  const canSubmit = useMemo(() => {
    return !!formData.email.trim() && !!formData.password.trim() && !isBusy;
  }, [formData.email, formData.password, isBusy]);

  // ---------------------------
  // HANDLE INPUTS
  // ---------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Keep UX smooth: don't trim end while typing, only prevent leading spaces
    setFormData((prev) => ({ ...prev, [name]: value.trimStart() }));
  };

  // ---------------------------
  // SUBMIT LOGIN
  // ---------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!email || !password) {
      setLoginPhase("idle");
      setErrorMessage("Please fill out all fields.");
      setSuccessMessage("");
      setShowPassword(false);
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setShowPassword(false);
    setShowResend(false);
    setLoginPhase("submitting");
    setLoading(true);

    // ======================
    // DEMO MODE
    // ======================
    if (DEMO_MODE) {
      setTimeout(() => {
        if (email === "user@example.com" && password === "123456") {
          const demoUser = { username: "demo_user", email, role: "user" };
          setLoggedInUser(demoUser);

          setLoginPhase("success");
          setSuccessMessage("Logged in successfully. Redirecting…");
          setShowPassword(false);
          setLoading(false);

          setTimeout(() => navigate("/"), 900);
        } else {
          setLoginPhase("error");
          setErrorMessage("Invalid email or password.");
          setLoading(false);
        }
      }, 700);
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

      // MFA required - go verify
      if (loginRes.data?.mfa_required) {
        setLoginPhase("mfa");
        setSuccessMessage("Credentials accepted. Redirecting to MFA verification…");
        setLoading(false);

        setTimeout(() => navigate("/mfa-verify"), 900);
        return;
      }

      if (loginRes.status !== 200) {
        setLoginPhase("error");
        setErrorMessage("Invalid email or password.");
        setLoading(false);
        return;
      }

      setLoginPhase("success");
      setSuccessMessage("Login successful. Redirecting…");

      // Fetch current user (cookie session)
      const meRes = await api.get("/users/me");
      setLoggedInUser(meRes.data);

      setLoading(false);
      setTimeout(() => navigate("/"), 900);
    } catch (err) {
      console.error("Login error:", err);

      const detail = err.response?.data?.detail;

      // Admin blocked from user login
      if (detail?.code === "ADMIN_LOGIN_FORBIDDEN") {
        setLoginPhase("error");
        setErrorMessage("Admins must use the admin panel to log in.");
        setLoading(false);
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

      setLoginPhase("error");
      setErrorMessage(msg);
      setSuccessMessage("");
      setLoading(false);
    }
  };

  // ---------------------------
  // RESEND VERIFICATION EMAIL
  // ---------------------------
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
      if (err.response?.status === 429) msg = "Please wait before requesting another email.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Small status label on the card header (UX clarity)
  const statusText =
    loginPhase === "submitting"
      ? "authorizing…"
      : loginPhase === "mfa"
      ? "mfa required"
      : loginPhase === "success"
      ? "ok"
      : loginPhase === "error"
      ? "error"
      : "ready";

  return (
    // Full-bleed section (matches Home behavior)
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen -mt-24 pt-24 pb-10">
      {/* Background layers (same recipe as Home) */}
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.12)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.90)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/12 via-[#050a07]/50 to-[#050a07]/82" />
        <div className="absolute inset-0 bg-[#050a07]/30" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 3px, transparent 6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {/* Your CSS layout wrappers */}
      <div className="auth-page">
        <div className="auth-shell">
          {/* Left panel (desktop only, your CSS controls display) */}
          <aside className="auth-side">
            <div className="auth-side-inner">
              <div className="auth-kicker">
                <span className="auth-dot" />
                SECURE://PWN-DEPOT • ACCESS
              </div>

              <div className="auth-title">
                Resume your <span style={{ color: "rgba(110,255,190,0.92)" }}>operator</span>{" "}
                session.
              </div>

              <div className="auth-subtitle">
                Log in to submit flags, track progress, and compete on the live scoreboard.
              </div>

              <ul className="auth-bullets">
                <li>Cookie-based session (secure transport)</li>
                <li>MFA supported (if enabled - enable it in your Profile Tab after logon)</li>
              </ul>

              <div className="auth-chip">
                <span className="auth-dot" style={{ height: 6, width: 6, opacity: 0.7 }} />
                <span>
                  status: <code>public</code> • transport: <code>tls</code>
                </span>
              </div>
            </div>
          </aside>

          {/* Card */}
          <div className="auth-card">
            <div className="auth-card-inner">
              <div className="auth-heading">
                <h2>Login</h2>
                <div className="auth-mini">
                  {DEMO_MODE ? "demo" : "live"} • {statusText}
                </div>
              </div>

              {/* Form */}
              {loginPhase !== "mfa" && (
                <form onSubmit={handleSubmit}>
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Email</span>
                      <span>required</span>
                    </div>
                    <input
                      className="auth-input"
                      type="email"
                      name="email"
                      placeholder="you@gmail.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={isBusy}
                      autoComplete="email"
                    />
                  </div>

                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Password</span>
                      <span>required</span>
                    </div>

                    <div className="auth-input-wrap">
                      <input
                        className="auth-input has-toggle"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="••••••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={isBusy}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="auth-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={isBusy}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <button className="auth-submit" type="submit" disabled={!canSubmit}>
                    {loginPhase === "submitting" ? "Logging in…" : loginPhase === "success" ? "Redirecting…" : "Login"}
                  </button>
                </form>
              )}

              {/* Feedback */}
              <Feedback type="error" message={errorMessage} />
              <Feedback type="success" message={successMessage} />

              {/* Resend verification */}
              {showResend && (
                <div className="auth-bottom" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={!loading ? handleResendVerification : undefined}
                    disabled={loading}
                    className="auth-submit"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderColor: "rgba(255,255,255,0.10)",
                      boxShadow: "none",
                      fontWeight: 800,
                    }}
                  >
                    {loading ? "Sending…" : "Resend verification email"}
                  </button>
                </div>
              )}

              {/* Bottom links */}
              <div className="auth-bottom">
                Don't have an account? <Link to="/register">Register</Link>
              </div>
              <div className="auth-bottom" style={{ marginTop: 8 }}>
                Forgot your password? <Link to="/reset-password">Reset it</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
