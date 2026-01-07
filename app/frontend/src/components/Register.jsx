// Register.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { evaluatePassword } from "../utils/passwordUtils";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";

export default function Register() {
  const navigate = useNavigate();

  // ---------------------------
  // Form state
  // ---------------------------
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ---------------------------
  // Password validation state
  // ---------------------------
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);

  // ---------------------------
  // Request state
  // ---------------------------
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const isBusy = loading || !!successMessage;

  // ---------------------------
  // Derived UI helpers
  // ---------------------------
  const isFormValid = isPasswordValid && doPasswordsMatch;

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

  const showMismatch = !doPasswordsMatch && formData.confirmPassword.length > 0;

  
  const warningMessage = useMemo(() => {
    if (!formData.password) return "";
    return "";
  }, [formData.password]);

  // ---------------------------
  // Handle input changes
  // ---------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Password match state
      setDoPasswordsMatch(updated.password === updated.confirmPassword);

      // Password strength state
      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordMessage(result.message);
        setPasswordStrength(result.strength);
        setIsPasswordValid(result.isValid);
      }

      return updated;
    });
  };

  // ---------------------------
  // Submit registration
  // ---------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid || !doPasswordsMatch) return;

    setErrorMessage("");
    setShowPassword(false);
    setShowConfirm(false);
    setSuccessMessage("");
    setLoading(true);

    // DEMO MODE (no backend)
    if (DEMO_MODE) {
      setSuccessMessage("Demo registration successful. Redirecting to login...");
      setLoading(false);
      setTimeout(() => navigate("/login"), 900);
      return;
    }

    try {
      await api.post("/users/register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      setSuccessMessage("Registration successful! Verification email sent. Redirecting...");
      setLoading(false);
      setTimeout(() => navigate("/login"), 1100);
    } catch (err) {
      console.error("Registration error:", err);

      let msg = "Registration failed. Please try again.";

      // Backend returns: { detail: "..." }
      if (err.response?.data?.detail) msg = err.response.data.detail;

      // Rate limit
      if (err.response?.status === 429) msg = "Too many attempts. Slow down.";

      // Pydantic validation errors
      if (err.response?.status === 422) {
        msg = err.response.data.detail?.[0]?.msg || "Invalid input.";
      }

      setErrorMessage(msg);
      setSuccessMessage("");
      setLoading(false);
    }
  };

  // ---------------------------
  // UI rule checks
  // ---------------------------
  const ruleLen = formData.password.length >= 12;
  const ruleUpper = /[A-Z]/.test(formData.password);
  const ruleNum = /[0-9]/.test(formData.password);
  const ruleSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

  return (
    // Full-bleed section exactly like Home (no CSS pseudo-element tricks)
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen -mt-24 pt-24 pb-10">
      {/* Background (1:1 with Home.jsx) */}
      <div className="absolute inset-0 z-0">
        {/* Background image */}
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />

        {/* Right-side fade */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.12)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.90)_100%)]" />

        {/* Green tint gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/12 via-[#050a07]/50 to-[#050a07]/82" />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#050a07]/30" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 3px, transparent 6px)",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="auth-page">
          <div className="auth-shell">
            {/* Left panel (desktop only) */}
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  SECURE://PWN-DEPOT • ONBOARDING
                </div>

                <div className="auth-title">
                  Create your
                  <br />
                  <span style={{ color: "rgba(110,255,190,0.95)" }}>operator</span> account.
                </div>

                <div className="auth-subtitle">
                  Join the CTF, track progress on the scoreboard, and unlock challenges in a clean terminal-style UI.
                </div>

                <ul className="auth-bullets">
                  <li>Email verification is required (anti-bot & abuse protection).</li>
                  <li>Use a strong passphrase to protect your account.</li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot" />
                  <span>
                    status: <code>public</code> • transport: <code>tls</code>
                  </span>
                </div>
              </div>
            </aside>

            {/* Form card */}
            <section className="auth-card">
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>Sign Up</h2>
                  <div className="auth-mini">{DEMO_MODE ? "demo mode" : "live"}</div>
                </div>

                <form onSubmit={handleSubmit} autoComplete="on">
                  {/* Username */}
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Username</span>
                      <span style={{ opacity: 0.65 }}>required</span>
                    </div>
                    <input
                      type="text"
                      name="username"
                      placeholder="e.g. rootkit_neo"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      disabled={isBusy}
                      className="auth-input"
                    />
                  </div>

                  {/* Email */}
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Email</span>
                      <span style={{ opacity: 0.65 }}>required</span>
                    </div>
                    <input
                      type="email"
                      name="email"
                      placeholder="you@gmail.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={isBusy}
                      className="auth-input"
                    />
                  </div>

                  {/* Password */}
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Password</span>
                      <span style={{ opacity: 0.65 }}>12+ chars</span>
                    </div>
                    <div className="auth-input-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="••••••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={isBusy}
                        className={[
                          "auth-input has-toggle",
                          formData.password.length > 0 && isPasswordValid ? "is-valid" : "",
                          formData.password.length > 0 && !isPasswordValid ? "is-invalid" : "",
                        ].join(" ")}
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

                  {/* Confirm password */}
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Confirm password</span>
                      <span style={{ opacity: 0.65 }}>must match</span>
                    </div>
                    <div className="auth-input-wrap">
                      <input
                        type={showConfirm ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="••••••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        disabled={isBusy}
                        className={[
                          "auth-input has-toggle",
                          formData.confirmPassword.length > 0 && doPasswordsMatch ? "is-valid" : "",
                          showMismatch ? "is-invalid" : "",
                        ].join(" ")}
                      />
                      <button
                        type="button"
                        className="auth-toggle"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                        disabled={isBusy}
                      >
                        {showConfirm ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={!isFormValid || isBusy} className="auth-submit">
                    {isBusy ? "Registering..." : "Create account"}
                  </button>
                </form>

                {/* Feedback messages */}
                {errorMessage && <div className="auth-feedback error">{errorMessage}</div>}
                {warningMessage && !errorMessage && !successMessage && (
                  <div className="auth-feedback warn">{warningMessage}</div>
                )}
                {successMessage && <div className="auth-feedback success">{successMessage}</div>}
                {showMismatch && !errorMessage && !successMessage && (
                  <div className="auth-feedback error">Passwords do not match.</div>
                )}

                {/* Password strength + rules */}
                <div className="auth-strength">
                  <div className="auth-strength-head">
                    <div className="auth-strength-title">Password requirements</div>
                    <div className="auth-strength-hint">strength: {passwordStrength}/4</div>
                  </div>

                  <div className="auth-strength-bar" aria-label="Password strength">
                    <div
                      className={`auth-strength-fill ${strengthClass}`}
                      style={{ width: strengthWidth }}
                    />
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

                {/* Bottom link */}
                <div className="auth-bottom">
                  Already have an account? <Link to="/login">Login</Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
