import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../config/api";

function Feedback({ type, children }) {
  if (!children) return null;
  const cls =
    type === "error"
      ? "auth-feedback error"
      : type === "success"
      ? "auth-feedback success"
      : "auth-feedback warn";
  return <div className={cls}>{children}</div>;
}

export default function MfaVerify({ setLoggedInUser }) {
  const navigate = useNavigate();

  const [rawCode, setRawCode] = useState("");
  const [error, setError] = useState("");
  const [warn, setWarn] = useState(
    "You can also use a one-time backup code if you lost access to your authenticator."
  );

  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);

  const redirectTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // StrictMode-safe: ensures redirect/timers start only once
  const redirectStartedRef = useRef(false);
  // prevents double-submit causing duplicate flows
  const inFlightRef = useRef(false);

  const normalizedCode = useMemo(
    () => rawCode.toUpperCase().replace(/\s/g, "").slice(0, 32),
    [rawCode]
  );

  const isLikelyTotp = useMemo(
    () => /^\d{6}$/.test(normalizedCode),
    [normalizedCode]
  );

  const canSubmit = useMemo(() => {
    if (loading || redirecting) return false;
    if (isLikelyTotp) return true;
    return normalizedCode.length >= 8;
  }, [loading, redirecting, isLikelyTotp, normalizedCode.length]);

  const clearTimers = () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      redirectStartedRef.current = false;
      inFlightRef.current = false;
    };
     
  }, []);

  const startRedirect = (ms = 1200) => {
    // critical: no double start (StrictMode / double click / re-render)
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;

    clearTimers();
    setRedirecting(true);
    setCountdownMs(ms);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownMs((prev) => {
        const next = prev - 100;
        return next <= 0 ? 0 : next;
      });
    }, 100);

    redirectTimeoutRef.current = setTimeout(() => {
      navigate("/", { replace: true });
    }, ms);
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!canSubmit) return;
    // prevents double submit even if StrictMode / fast clicks
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    setError("");
    setWarn("");

    try {
      await api.post("/mfa/verify", { code: normalizedCode });

      const meRes = await api.get("/users/me");
      setLoggedInUser(meRes.data);

      startRedirect(1200);
    } catch (err) {
      console.error(err);

      // allow another try after failure
      inFlightRef.current = false;
      redirectStartedRef.current = false;

      setError("Invalid code. Please try again.");
      setWarn("Tip: codes change every 30 seconds. Make sure your device time is correct.");
    } finally {
      setLoading(false);
      // if redirecting started, we keep inFlight locked (so no second submit)
      if (!redirectStartedRef.current) inFlightRef.current = false;
    }
  };

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      {/* Background layers (same terminal vibe as MFA Setup) */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage:
              "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.10)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-[#050a07]/55 to-[#050a07]/85" />
        <div className="absolute inset-0 bg-[#050a07]/30" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 3px, transparent 6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="auth-page">
          <div className="auth-shell">
            {/* Left panel (desktop) */}
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  SECURE://PWN-DEPOT • MFA-VERIFY
                </div>

                <div className="auth-title">
                  Confirm
                  <br />
                  <span className="auth-title-accent">two-factor</span> access.
                </div>

                <div className="auth-subtitle">
                  Enter your 6-digit authenticator code. If you lost access to your device,
                  you can use a backup code instead.
                </div>

                <ul className="auth-bullets">
                  <li>Authenticator codes refresh frequently — type the newest one.</li>
                  <li>Backup codes are one-time use. Store them securely.</li>
                  <li>We never ask for your secret key here.</li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot auth-dot-soft" />
                  <span>
                    mode: <code>{isLikelyTotp ? "totp" : "backup"}</code> • input:{" "}
                    <code>{normalizedCode.length || 0}</code> chars
                  </span>
                </div>
              </div>
            </aside>

            {/* Right card */}
            <section className="auth-card">
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>Two-Factor Verification</h2>
                  <div className="auth-mini">operator</div>
                </div>

                <Feedback type="error">{error}</Feedback>
                <Feedback type="warn">{warn}</Feedback>

                {/* single success message (only while redirecting) */}
                {redirecting && (
                  <Feedback type="success">
                    MFA verification successful. Logging you in… Redirecting in{" "}
                    {Math.max(1, Math.ceil(countdownMs / 1000))}…
                  </Feedback>
                )}

                <form onSubmit={handleVerify} className="mt-3">
                  <div className="auth-field">
                    <div className="auth-label">
                      <span>Verification code</span>
                      <span style={{ opacity: 0.7 }}>
                        {isLikelyTotp ? "6 digits" : "backup code"}
                      </span>
                    </div>

                    <input
                      type="text"
                      inputMode={isLikelyTotp ? "numeric" : "text"}
                      placeholder="123456 or backup code"
                      value={normalizedCode}
                      onChange={(e) => {
                        setRawCode(e.target.value);
                        if (error) setError("");
                        if (!warn) {
                          setWarn(
                            "You can also use a one-time backup code if you lost access to your authenticator."
                          );
                        }
                      }}
                      autoComplete="one-time-code"
                      className={`auth-input mono mfa-code ${
                        error ? "is-invalid" : canSubmit ? "is-valid" : ""
                      }`}
                      disabled={loading || redirecting}
                      aria-label="MFA verification code"
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={!canSubmit}
                    title={
                      !normalizedCode
                        ? "Enter your code"
                        : isLikelyTotp
                        ? "Submit 6-digit code"
                        : "Submit backup code"
                    }
                  >
                    {loading ? "Verifying..." : redirecting ? "Logging in..." : "Verify"}
                  </button>

                  {!isLikelyTotp &&
                    normalizedCode.length > 0 &&
                    normalizedCode.length < 8 && (
                      <Feedback type="warn">
                        Backup codes are usually longer than 6 digits.
                      </Feedback>
                    )}
                </form>

                <div className="auth-bottom">
                  Having trouble? Double-check device time sync or use a backup code.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}