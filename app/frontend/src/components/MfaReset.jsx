// src/components/MfaReset.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../config/api";

export default function MfaReset({ setLoggedInUser }) {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // phases: idle | submitting | success | error
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(3);

  const canSubmit = useMemo(() => {
    return password.trim().length >= 12 && status !== "submitting" && status !== "success";
  }, [password, status]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLogoutCountdown = () => {
    clearTimer();
    setCountdown(3);
    setStatus("success");

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearTimer();

          // local logout
          setLoggedInUser?.(null);

          // go login with reason
          navigate("/login?reason=logging_out&from=mfa_reset", { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    // UX/Security: hide password on submit
    setShowPassword(false);
    setErrorMsg("");
    setStatus("submitting");

    try {
      await api.post("/mfa/reset", { password: password.trim() });

      // Best-effort logout endpoint 
      try {
        await api.post("/users/logout");
      } catch {
        // ignore
      }

      startLogoutCountdown();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const code = detail?.code;
      const msg = detail?.message;

      if (code === "INVALID_PASSWORD") {
        setErrorMsg("Invalid password.");
      } else if (err?.response?.status === 403) {
        setErrorMsg("This action is only allowed during a recovery session.");
      } else if (err?.response?.status === 400) {
        setErrorMsg("MFA is not enabled on this account.");
      } else {
        setErrorMsg(msg || "MFA reset failed. Please try again.");
      }

      setStatus("error");
    }
  };

  // Clear error when user edits password
  useEffect(() => {
    if (status === "error") {
      setErrorMsg("");
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      {/* Background layers */}
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

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="admin-topbar">
          <div>
            <div className="admin-kicker admin-kicker--secure">
              <span className="admin-dot admin-dot-soft admin-dot--secure" />
              secure://pwn-depot • mfa reset
            </div>
            <div className="admin-topbar-title mono">Recovery reset</div>
            <div className="admin-topbar-sub admin-topbar-sub--secure">
              Disable MFA using a recovery session. Requires your password.
            </div>
          </div>
        </div>

        <section className="admin-surface admin-surface--secure">
          <div className="admin-surface-head">
            <div>
              <div className="admin-surface-title">Confirm MFA reset</div>
              <div className="admin-surface-meta">
                This will disable two-factor authentication and log you out.
              </div>
            </div>

            <div className="admin-surface-pill">danger</div>
          </div>

          <div className="p-4">
            <div className="admin-feedback warn">
              You can reset MFA <span className="mono">only</span> during a recovery
              session. After reset, you must log in again.
            </div>

            <form onSubmit={submitReset} className="mt-4">
              <label className="admin-field">
                <div className="admin-label">
                  <span>Account password</span>
                  <span className="admin-hint">min 12 chars</span>
                </div>

                <div className="admin-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="admin-input has-toggle"
                    placeholder="enter your password to confirm"
                    disabled={status === "submitting" || status === "success"}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="admin-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={status === "submitting" || status === "success"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {/* Actions */}
              <div
                className="mt-4 flex flex-col sm:flex-row gap-3"
                style={{ alignItems: "stretch" }}
              >
                <button
                  type="submit"
                  className="admin-btn admin-btn-danger"
                  disabled={!canSubmit}
                  title="Disable MFA and log out"
                  style={{ flex: 1 }}
                >
                  {status === "submitting" ? "resetting…" : "Confirm Reset"}
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-ghost--secure"
                  onClick={() => navigate(-1)}
                  disabled={status === "submitting" || status === "success"}
                  style={{ flex: 1 }}
                >
                  Back To Profile
                </button>
              </div>

              {/* Feedback */}
              {status === "success" && (
                <div className="admin-feedback success mt-3">
                  MFA reset successful. Logging out in{" "}
                  <span className="mono">{countdown}</span>…
                </div>
              )}

              {status === "error" && (
                <div className="admin-feedback error mt-3">
                  {errorMsg || "MFA reset failed."}
                </div>
              )}

              {status === "idle" && password.trim().length > 0 && password.trim().length < 12 && (
                <div className="admin-feedback warn mt-3">
                  Password must be at least <span className="mono">12</span> characters.
                </div>
              )}

              {status === "idle" && password.trim().length === 0 && (
                <div className="admin-feedback warn mt-3">
                  Tip: after reset you'll need to set up MFA again to re-enable it.
                </div>
              )}
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
