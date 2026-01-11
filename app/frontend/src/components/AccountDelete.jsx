// src/components/AccountDelete.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../config/api";
import "../index.css";

/**
 * AccountDelete
 * -------------
 * Step-up destructive action hardened against password managers.
 *
 * Guarantees:
 * - Clean entry: ONLY password field is visible
 * - MFA appears ONLY after backend returns MFA_REQUIRED (password accepted)
 * - Once MFA stage: password is locked and force-hidden
 * - Stage + countdown are remount-safe (sessionStorage)
 * - NO time-based hiding; only hide on explicit submit actions
 * - Best-effort logout happens BEFORE redirect (and again at redirect boundary)
 */

const STORE_KEY = "pwndepot:account_delete:v5";

const BG_URL =
  "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU";

function readStore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStore(next) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function clearStore() {
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

function nowMs() {
  return Date.now();
}

export default function AccountDelete({ loggedInUser, setLoggedInUser }) {
  const navigate = useNavigate();
  const tickRef = useRef(null);

  const [stage, setStage] = useState("password"); // "password" | "mfa"
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showMfa, setShowMfa] = useState(false);

  // idle | verifying | deleting | success
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [deadlineMs, setDeadlineMs] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const isRecovery = loggedInUser?.token_data?.mfa_recovery === true;
  const passwordLocked = stage === "mfa";

  const hardLocked = status === "success";

  const doBestEffortLogout = useCallback(async () => {
    // 1) best-effort backend logout
    try {
        await api.post("/users/logout");
    } catch {
        // ignore
    }
    }, []);

  // Hydrate on mount
  useEffect(() => {
    const s = readStore();
    if (!s) return;

    if (s.stage === "mfa") {
      setStage("mfa");
      if (typeof s.password === "string") setPassword(s.password);
      if (typeof s.mfaCode === "string") setMfaCode(s.mfaCode);
    }

    if (s.status === "success" && typeof s.deadlineMs === "number") {
      setStatus("success");
      setDeadlineMs(s.deadlineMs);
    }
  }, []);

  // Persist only meaningful stuff
  useEffect(() => {
    const current = readStore() || {};
    const next = { ...current };

    if (stage === "mfa") {
      next.stage = "mfa";
      next.password = password;
      next.mfaCode = mfaCode;
    }

    if (status === "success" && typeof deadlineMs === "number") {
      next.status = "success";
      next.deadlineMs = deadlineMs;
    }

    if (stage === "mfa" || status === "success") {
      writeStore(next);
    }
  }, [stage, password, mfaCode, status, deadlineMs]);

  const passwordOk = useMemo(() => password.trim().length >= 12, [password]);
  const mfaOk = useMemo(() => /^\d{6}$/.test(mfaCode.trim()), [mfaCode]);

  const canVerifyPassword = useMemo(() => {
    return !isRecovery && stage === "password" && passwordOk && status === "idle";
  }, [isRecovery, stage, passwordOk, status]);

  const canDelete = useMemo(() => {
    return !isRecovery && stage === "mfa" && mfaOk && status === "idle";
  }, [isRecovery, stage, mfaOk, status]);

  const startSuccessCountdown = () => {
    const dl = nowMs() + 5000;
    setDeadlineMs(dl);
    setCountdown(5);
    setStatus("success");
    setErrorMsg("");
    writeStore({ stage, password, mfaCode, status: "success", deadlineMs: dl });
  };

  // Countdown ticker
  useEffect(() => {
    if (status !== "success" || typeof deadlineMs !== "number") return;

    const update = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - nowMs()) / 1000));
      setCountdown(left);

      if (left <= 0) {
        // Second logout attempt right before redirect (edge-case hardening)
        doBestEffortLogout().finally(() => {
          setLoggedInUser?.(null);
          clearStore();
          navigate("/login?reason=account_deleted", { replace: true });
        });
      }
    };

    update();

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(update, 250);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [status, deadlineMs, navigate, doBestEffortLogout, setLoggedInUser]);

  // STEP 1: verify password (trigger MFA_REQUIRED)
  const submitVerifyPassword = async (e) => {
    e.preventDefault();
    if (!canVerifyPassword) return;

    setErrorMsg("");
    setStatus("verifying");
    setShowPassword(false);

    try {
      await api.post("/users/me/delete", { password: password.trim() });

      // Edge case: backend deleted without MFA
      await doBestEffortLogout();
      startSuccessCountdown();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const code = detail?.code;
      const msg = detail?.message;

      if (code === "INVALID_PASSWORD") {
        setErrorMsg("Invalid password.");
        setStatus("idle");
        return;
      }

      if (code === "MFA_REQUIRED" || code === "INVALID_MFA" || code === "MFA_MISCONFIGURED") {
        // Latch MFA stage and persist immediately
        setStage("mfa");
        setMfaCode("");
        setShowMfa(false);
        setShowPassword(false);

        writeStore({ stage: "mfa", password, mfaCode: "" });

        setErrorMsg(
          code === "MFA_MISCONFIGURED"
            ? "MFA is enabled but misconfigured."
            : "Enter your MFA code to continue."
        );
        setStatus("idle");
        return;
      }

      if (err?.response?.status === 403) {
        setErrorMsg("This action is not allowed in the current session.");
      } else if (err?.response?.status === 429) {
        setErrorMsg("Too many attempts. Please wait and try again.");
      } else {
        setErrorMsg(msg || "Password verification failed.");
      }

      setStatus("idle");
    }
  };

  // STEP 2: final delete
  const submitDelete = async (e) => {
    e.preventDefault();
    if (!canDelete) return;

    setErrorMsg("");
    setStatus("deleting");
    setShowPassword(false);
    setShowMfa(false);

    try {
      await api.post("/users/me/delete", {
        password: password.trim(),
        mfa_code: mfaCode.trim(),
      });

      await doBestEffortLogout();
      startSuccessCountdown();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const code = detail?.code;
      const msg = detail?.message;

      if (code === "INVALID_MFA") {
        setErrorMsg("Invalid MFA code.");
      } else if (code === "MFA_REQUIRED") {
        setErrorMsg("MFA code is required.");
      } else if (err?.response?.status === 429) {
        setErrorMsg("Too many attempts. Please wait and try again.");
      } else {
        setErrorMsg(msg || "Account deletion failed.");
      }

      setStatus("idle");
    }
  };

  const onSubmit = stage === "mfa" ? submitDelete : submitVerifyPassword;

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: `url('${BG_URL}')`,
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
              SECURE://PWN-DEPOT • ACCOUNT DELETION
            </div>
            <div className="admin-topbar-title mono">Delete account</div>
            <div className="admin-topbar-sub admin-topbar-sub--secure">
              This action is permanent and cannot be undone.
            </div>
          </div>
        </div>

        <section className="admin-surface admin-surface--secure">
          <div className="admin-surface-head">
            <div>
              <div className="admin-surface-title">Confirm account deletion</div>
              <div className="admin-surface-meta">All data will be permanently removed.</div>
            </div>
            <div className="admin-surface-pill">danger</div>
          </div>

          <div className="p-4 relative">
            {hardLocked && (
              <div
                className="absolute inset-0 z-20 rounded-[18px]"
                style={{ background: "rgba(0,0,0,0.25)" }}
                aria-hidden="true"
              />
            )}

            {isRecovery ? (
              <div className="admin-feedback error">
                Account deletion is blocked during a recovery session.
              </div>
            ) : (
              <div className="admin-feedback warn">
                You must re-authenticate to delete your account.
              </div>
            )}

            <form
              className="mt-4"
              autoComplete="off"
              onSubmit={onSubmit}
              style={hardLocked ? { pointerEvents: "none" } : undefined}
            >
              {/* Decoys to attract password managers */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />

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
                    placeholder="Enter your password"
                    disabled={passwordLocked || status !== "idle"}
                    autoComplete="off"
                    name="delete_confirm_secret"
                    aria-autocomplete="none"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    className="admin-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={passwordLocked || status !== "idle"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {stage === "mfa" && (
                <label className="admin-field mt-3">
                  <div className="admin-label">
                    <span>MFA code</span>
                    <span className="admin-hint">6-digit TOTP</span>
                  </div>

                  <div className="admin-input-wrap">
                    <input
                      type="text"
                      value={mfaCode}
                      maxLength={6}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setMfaCode(v);
                      }}
                      className="admin-input has-toggle"
                      placeholder="123456"
                      disabled={status !== "idle"}
                      inputMode="numeric"
                      autoComplete="off"
                      name="delete_confirm_otp"
                      aria-autocomplete="none"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      style={showMfa ? undefined : { WebkitTextSecurity: "disc" }}
                    />
                    <button
                      type="button"
                      className="admin-toggle"
                      onClick={() => setShowMfa((v) => !v)}
                      disabled={status !== "idle"}
                      aria-label={showMfa ? "Hide MFA code" : "Show MFA code"}
                    >
                      {showMfa ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              )}

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                {stage === "password" ? (
                  <button
                    type="submit"
                    className="admin-btn admin-btn-danger"
                    disabled={!canVerifyPassword}
                    style={{ flex: 1 }}
                  >
                    {status === "verifying" ? "Verifying password…" : "Continue"}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="admin-btn admin-btn-danger"
                    disabled={!canDelete}
                    style={{ flex: 1 }}
                  >
                    {status === "deleting" ? "Deleting your account…" : "Delete Account"}
                  </button>
                )}

                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-ghost--secure"
                  onClick={() => {
                    clearStore();
                    navigate(-1);
                  }}
                  disabled={status !== "idle" || hardLocked}
                  style={{ flex: 1 }}
                >
                  Back to Profile
                </button>
              </div>

              {status === "success" && (
                <div className="admin-feedback success mt-3">
                  Account deleted. Redirecting in <span className="mono">{countdown}</span>…
                </div>
              )}

              {!!errorMsg && status !== "success" && (
                <div className="admin-feedback error mt-3">{errorMsg}</div>
              )}

              {status === "idle" && stage === "password" && password.trim().length > 0 && password.trim().length < 12 && (
                <div className="admin-feedback warn mt-3">
                  Password must be at least <span className="mono">12</span> characters.
                </div>
              )}

              {status === "idle" && stage === "mfa" && mfaCode.trim().length > 0 && !/^\d{6}$/.test(mfaCode.trim()) && (
                <div className="admin-feedback warn mt-3">
                  MFA code must be exactly <span className="mono">6</span> digits.
                </div>
              )}
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
