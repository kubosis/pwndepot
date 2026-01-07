// src/pages/JoinTeam.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "../config/api";

function Feedback({ type = "warn", children }) {
  if (!children) return null;
  const cls =
    type === "error"
      ? "admin-feedback error"
      : type === "success"
      ? "admin-feedback success"
      : "admin-feedback warn";
  return <div className={cls}>{children}</div>;
}

export default function JoinTeam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [teamName, setTeamName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [exchangeCode, setExchangeCode] = useState("");

  const [enteredPassword, setEnteredPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const [success, setSuccess] = useState("");

  const passOk = enteredPassword.length >= 8;
  const canJoin = !!exchangeCode && passOk && !submitting && !previewLoading;

  const tokenState = useMemo(() => {
    if (!token) return "missing";
    if (previewLoading) return "probing";
    if (teamName) return "ready";
    return "invalid";
  }, [token, previewLoading, teamName]);

  // -------------------------
  // Preview invite
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
    setError("");
    setWarn("");
    setSuccess("");
    setTeamName("");
    setExchangeCode("");
    setPreviewLoading(true);

    setEnteredPassword("");
    setShowPassword(false);

    if (!token) {
      setError("Invalid team invite link (missing token).");
      setPreviewLoading(false);
      return;
    }

    try {
      // 1) EXCHANGE token - exchange_code (TTL 1 day, one-time use)
      const ex = await api.post("/teams/invite/exchange", { token });
      const code = ex.data?.exchange_code;
      if (!code) throw new Error("No exchange_code");
      if (cancelled) return;

      setExchangeCode(code);

      // 2) Preview team name (existing endpoint)
      const res = await api.get(`/teams/join?token=${token}`);
      if (cancelled) return;

      setTeamName(res.data.team_name || "");
      setWarn("Invite link validated. Enter the team password to join.");

      // 3) Remove token from URL (prevents referrer/log leaks)
      window.history.replaceState({}, "", "/join-team");
    } catch (e) {
      console.error(e);
      if (cancelled) return;
      setError("Invite link not recognized or expired.");
    } finally {
      if (!cancelled) setPreviewLoading(false);
    }
  };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // -------------------------
  // Join action
  // -------------------------
  const handleJoin = async (e) => {
    e?.preventDefault?.();

    setError("");
    setWarn("");
    setSuccess("");
    setShowPassword(false);

    if (!token) {
      setError("Invalid team invite link.");
      return;
    }
    if (!passOk) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (submitting) return;

    setSubmitting(true);

    try {
      if (!exchangeCode) {
        setError("Invite code expired. Refresh the page to retry.");
        return;
      }

      const res = await api.post("/teams/join-exchange", {
        exchange_code: exchangeCode,
        password: enteredPassword,
      });

      const joined = res.data?.team_name || teamName || "team";
      setSuccess(`Joined ${joined}. Redirecting…`);
      setTimeout(() => navigate(`/team/${joined}`), 900);
    } catch (err) {
      const detail = err.response?.data?.detail;

      // exchange TTL / one-time used
      if (
        detail &&
        (detail.includes("Exchange code invalid") ||
          detail.includes("expired") ||
          detail.includes("invalid or expired"))
      ) {
        setError("Invite expired. Refresh the page to get a new one.");
        return;
      }

      if (err.response?.status === 401) {
        setError("Incorrect team password.");
      } else {
        setError(detail || "Failed to join team.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      {/* Background */}
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
        <div className="auth-page">
          <div className="auth-shell join-shell">
            {/* Left panel */}
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  secure://pwn-depot • join
                </div>

                <div className="auth-title">
                  Join
                  <br />
                  <span style={{ color: "rgba(110,255,190,0.95)" }}>
                    a team
                  </span>
                  .
                </div>

                <div className="auth-subtitle">
                  Validate the invite token, then confirm with the team password.
                  If the token is invalid, request a new link.
                </div>

                <ul className="auth-bullets">
                  <li>Invite links can expire or be revoked.</li>
                  <li>Password must match the team password.</li>
                  <li>After joining, you’ll be redirected automatically.</li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot" />
                  <span>
                    token: <code>{tokenState}</code> • transport:{" "}
                    <code>tls</code>
                  </span>
                </div>
              </div>
            </aside>

            {/* Card */}
            <section className="auth-card join-card">
              <div className="auth-card-inner join-card-inner">
                <div className="auth-heading">
                  <h2>Join Team</h2>
                  <div className="auth-mini">operator</div>
                </div>

                <div className="join-feedback">
                  <Feedback type="error">{error}</Feedback>
                  <Feedback type="warn">{warn}</Feedback>
                  <Feedback type="success">{success}</Feedback>
                </div>

                {previewLoading ? (
                  <div className="admin-feedback warn" style={{ marginTop: 10 }}>
                    Validating invite…
                  </div>
                ) : !teamName ? (
                  <div
                    className="join-actions join-actions--center"
                    style={{ marginTop: 12 }}
                  >
                    <Link to="/teams" className="admin-btn admin-btn-ghost">
                      Back To Teams
                    </Link>
                    <Link to="/rankings" className="admin-btn admin-btn-ghost">
                      Scoreboard
                    </Link>
                  </div>
                ) : (
                  <div className="join-layout" style={{ marginTop: 12 }}>
                    <div className="join-panels">
                      {/* Preview */}
                      <div className="team-join-panel join-preview">
                        <div className="admin-label">
                          <span>Joining team</span>
                          <span className="admin-hint">preview</span>
                        </div>

                        <div className="team-join-team mono">{teamName}</div>

                        <div className="admin-mini" style={{ marginTop: 8 }}>
                          If you don’t know the password, ask a teammate who
                          created the team.
                        </div>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleJoin} className="team-join-panel join-form">
                        <label className="admin-field" style={{ marginTop: 0 }}>
                          <div className="admin-label">
                            <span>Team password</span>
                            <span className="admin-hint">
                              {passOk ? "ok" : "min 8 characters"}
                            </span>
                          </div>

                          <div className="auth-input-wrap">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter team password"
                              value={enteredPassword}
                              onChange={(e) => {
                                setEnteredPassword(e.target.value);
                                if (error) setError("");
                                if (success) setSuccess("");
                              }}
                              className="admin-input mono has-toggle join-pass-input"
                              autoComplete="current-password"
                              disabled={submitting}
                            />

                            <button
                              type="button"
                              className="auth-toggle join-toggle"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={
                                showPassword
                                  ? "Hide team password"
                                  : "Show team password"
                              }
                              disabled={submitting}
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>

                        <button
                          type="submit"
                          className="admin-btn admin-btn-primary"
                          disabled={!canJoin}
                        >
                          {submitting ? "Joining…" : "Join Team"}
                        </button>
                      </form>
                    </div>

                    {/* Centered actions */}
                    <div className="join-actions join-actions--center">
                      <Link to="/teams" className="admin-btn admin-btn-ghost">
                        Back To Teams
                      </Link>
                      <Link to="/rankings" className="admin-btn admin-btn-ghost">
                        Scoreboard
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
