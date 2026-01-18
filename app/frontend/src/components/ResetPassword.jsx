// src/components/ResetPassword.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../config/api";
import { evaluatePassword } from "../utils/passwordUtils";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const isResetMode = !!token;

  // ---------------------------
  // STATE (kept exactly)
  // ---------------------------
  const [email, setEmail] = useState("");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Token status
  const [tokenStatus, setTokenStatus] = useState(isResetMode ? "checking" : "idle");
  // idle | checking | valid | invalid | expired

  // NEW: show/hide toggles
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isBusy = loading || tokenStatus === "checking";
  const isFormValid = isPasswordValid && doPasswordsMatch && tokenStatus === "valid";

  const showMismatch = !doPasswordsMatch && formData.confirmPassword.length > 0;

  // ---------------------------
  // VERIFY RESET TOKEN (kept)
  // ---------------------------
  useEffect(() => {
    if (!token) return;

    setTokenStatus("checking");

    api
      .get("/users/reset-password/verify", { params: { token } })
      .then(() => setTokenStatus("valid"))
      .catch((err) => {
        if (err.response?.status === 410) setTokenStatus("expired");
        else setTokenStatus("invalid");
      });
  }, [token]);

  // ---------------------------
  // PASSWORD INPUT (kept)
  // ---------------------------
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      setDoPasswordsMatch(updated.password === updated.confirmPassword);

      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordStrength(result.strength);
        setPasswordMessage(result.message);
        setIsPasswordValid(result.isValid);
      }

      return updated;
    });
  };

  // ---------------------------
  // REQUEST RESET (EMAIL) (kept)
  // ---------------------------
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await api.post("/users/forgot-password", { email });

      setSuccessMessage("If the account exists, a reset link was sent to your email.");
    } catch (err) {
      let msg = "Unable to process request.";

      if (err.response?.status === 429) {
        msg = "Too many requests. Please wait before trying again.";
      }

      setErrorMessage(msg);
    } finally {
      // UX delay (kept)
      setTimeout(() => setLoading(false), 1200);
    }
  };

  // ---------------------------
  // RESET PASSWORD (kept)
  // ---------------------------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    // UX/Security: hide both fields on submit
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await api.post("/users/reset-password", {
        token,
        password: formData.password,
      });

      setSuccessMessage(res.data?.message || "Password has been reset successfully.");

      // redirect to login after success (kept)
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      let msg = "Unable to reset password.";

      if (status === 400 && detail?.code === "PASSWORD_REUSE") {
        msg = "New password must be different from the old password.";
      } else if (status === 400) {
        msg = "Reset password link is invalid.";
      } else if (status === 410) {
        msg = "Reset password link has expired.";
      } else if (status === 422) {
        msg = detail?.[0]?.msg || "Invalid password.";
      }

      setErrorMessage(msg);
      setLoading(false);
    }
  };

  // ---------------------------
  // Strength UI helpers (matches Register)
  // ---------------------------
  const strengthClass = useMemo(() => {
    if (passwordStrength < 2) return "weak";
    if (passwordStrength === 2 || passwordStrength === 3) return "moderate";
    if (passwordStrength === 4) return "strong";
    return "weak";
  }, [passwordStrength]);

  const strengthWidth = useMemo(() => {
    const pct = Math.max(0, Math.min(4, passwordStrength)) / 4;
    return `${pct * 100}%`;
  }, [passwordStrength]);

  // Password rules (UI only)
  const ruleLen = formData.password.length >= 12;
  const ruleUpper = /[A-Z]/.test(formData.password);
  const ruleNum = /[0-9]/.test(formData.password);
  const ruleSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

  // Small helper: warning message for token flow
  const tokenWarn = useMemo(() => {
    if (!isResetMode) return "";
    if (tokenStatus === "checking") return "Verifying reset password link…";
    if (tokenStatus === "invalid") return "Reset password link is invalid.";
    if (tokenStatus === "expired") return "Reset password link has expired.";
    return "";
  }, [isResetMode, tokenStatus]);

  const canRequest = !!email.trim() && !isBusy;

  return (
    // Full-bleed section EXACTLY like Register/Home (fixes background + centering)
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen -mt-24 pt-24 pb-10">
      {/* Background (1:1 with Register/Home.jsx) */}
      <div className="absolute inset-0 z-0">
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

      {/* Foreground content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="auth-page">
          <div className="auth-shell">
            {/* Left panel (desktop only) */}
            <aside className="auth-side" style={{ marginBottom: 0 }}>
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  secure://pwn-depot • recovery
                </div>

                <div className="auth-title">
                  {isResetMode ? (
                    <>
                      Set a new
                      <br />
                      <span style={{ color: "rgba(110,255,190,0.95)" }}>passphrase</span>.
                    </>
                  ) : (
                    <>
                      Recover your
                      <br />
                      <span style={{ color: "rgba(110,255,190,0.95)" }}>account</span>.
                    </>
                  )}
                </div>

                <div className="auth-subtitle">
                  {isResetMode
                    ? "Your reset link is being verified. If it’s valid, choose a strong new password."
                    : "Enter your email and we will send a reset link (if the account exists)."}
                </div>

                <ul className="auth-bullets">
                  <li>No account enumeration (privacy-safe messaging).</li>
                  <li>One-time token verification before allowing a reset.</li>
                  <li>Tip: Use a long passphrase + symbols.</li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot" />
                  <span>
                    status: <code>public</code> • transport: <code>tls</code>
                  </span>
                </div>
              </div>
            </aside>

            {/* Card */}
            <section className="auth-card" style={{ marginTop: 0 }}>
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>Reset Password</h2>
                  <div className="auth-mini">
                    {!isResetMode ? "request link" : tokenStatus === "valid" ? "verified" : "verifying"}
                  </div>
                </div>

                {/* TOKEN WARNINGS (orange) */}
                {isResetMode && tokenStatus !== "valid" && tokenWarn && (
                  <div className="auth-feedback warn">{tokenWarn}</div>
                )}

                {/* REQUEST MODE (NO TOKEN) */}
                {!isResetMode && (
                  <>
                    <form onSubmit={handleRequestReset} autoComplete="on">
                      <div className="auth-field">
                        <div className="auth-label">
                          <span>Email</span>
                          <span style={{ opacity: 0.65 }}>required</span>
                        </div>
                        <input
                          type="email"
                          placeholder="you@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isBusy}
                          className="auth-input"
                          autoComplete="email"
                        />
                      </div>

                      <button type="submit" disabled={!canRequest} className="auth-submit">
                        {isBusy ? "Sending..." : "Send reset link"}
                      </button>
                    </form>

                    {/* Feedback */}
                    {errorMessage && <div className="auth-feedback error">{errorMessage}</div>}
                    {successMessage && <div className="auth-feedback success">{successMessage}</div>}

                    <div className="auth-bottom">
                      <Link to="/login" className="auth-link">
                        Back to Login
                      </Link>
                    </div>
                  </>
                )}

                {/* INVALID/EXPIRED HANDLING */}
                {isResetMode && tokenStatus === "invalid" && (
                  <div className="auth-bottom" style={{ marginTop: 12 }}>
                    <Link to="/reset-password" className="auth-link">
                      Request a new reset link
                    </Link>
                  </div>
                )}

                {isResetMode && tokenStatus === "expired" && (
                  <div className="auth-bottom" style={{ marginTop: 12 }}>
                    <Link to="/reset-password" className="auth-link">
                      Request a new reset link
                    </Link>
                  </div>
                )}

                {/* RESET FORM (VALID TOKEN) */}
                {isResetMode && tokenStatus === "valid" && (
                  <>
                    <form onSubmit={handleResetPassword} autoComplete="on">
                      <div className="auth-field">
                        <div className="auth-label">
                          <span>New password</span>
                          <span style={{ opacity: 0.65 }}>12+ chars</span>
                        </div>

                        {/* show/hide wrapper */}
                        <div className="auth-input-wrap">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="password"
                            placeholder="••••••••••••"
                            value={formData.password}
                            onChange={handlePasswordChange}
                            disabled={isBusy}
                            required
                            className={[
                              "auth-input has-toggle",
                              formData.password.length > 0 && isPasswordValid ? "is-valid" : "",
                              formData.password.length > 0 && !isPasswordValid ? "is-invalid" : "",
                            ].join(" ")}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="auth-toggle"
                            onClick={() => setShowNewPassword((v) => !v)}
                            disabled={isBusy}
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                          >
                            {showNewPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="auth-field">
                        <div className="auth-label">
                          <span>Confirm password</span>
                          <span style={{ opacity: 0.65 }}>must match</span>
                        </div>

                        {/* show/hide wrapper */}
                        <div className="auth-input-wrap">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            placeholder="••••••••••••"
                            value={formData.confirmPassword}
                            onChange={handlePasswordChange}
                            disabled={isBusy}
                            required
                            className={[
                              "auth-input has-toggle",
                              formData.confirmPassword.length > 0 && doPasswordsMatch ? "is-valid" : "",
                              showMismatch ? "is-invalid" : "",
                            ].join(" ")}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="auth-toggle"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            disabled={isBusy}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <button type="submit" disabled={!isFormValid || isBusy} className="auth-submit">
                        {isBusy ? "Resetting..." : "Reset password"}
                      </button>
                    </form>

                    {/* Feedback */}
                    {errorMessage && <div className="auth-feedback error">{errorMessage}</div>}
                    {successMessage && <div className="auth-feedback success">{successMessage}</div>}
                    {showMismatch && !errorMessage && !successMessage && (
                      <div className="auth-feedback error">Passwords do not match.</div>
                    )}

                    {/* Strength + rules */}
                    <div className="auth-strength">
                      <div className="auth-strength-head">
                        <div className="auth-strength-title">Password requirements</div>
                        <div className="auth-strength-hint">strength: {passwordStrength}/4</div>
                      </div>

                      <div className="auth-strength-bar" aria-label="Password strength">
                        <div className={`auth-strength-fill ${strengthClass}`} style={{ width: strengthWidth }} />
                      </div>

                      <div className="auth-strength-msg">{passwordMessage}</div>

                      <ul className="auth-rules">
                        <li className={`auth-rule ${ruleLen ? "valid" : "invalid"}`}>
                          <span className="dot" /> At least 12 characters
                        </li>
                        <li className={`auth-rule ${ruleUpper ? "valid" : "invalid"}`}>
                          <span className="dot" /> At least 1 uppercase letter
                        </li>
                        <li className={`auth-rule ${ruleNum ? "valid" : "invalid"}`}>
                          <span className="dot" /> At least 1 number
                        </li>
                        <li className={`auth-rule ${ruleSpecial ? "valid" : "invalid"}`}>
                          <span className="dot" /> At least 1 special character
                        </li>
                      </ul>
                    </div>

                    <div className="auth-bottom">
                      <Link to="/login" className="auth-link">
                        Back to Login
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Extra breathing room on very small heights (prevents "sticking") */}
          <div className="h-6" />
        </div>
      </div>
    </section>
  );
}
