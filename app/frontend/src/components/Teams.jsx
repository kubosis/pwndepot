// src/pages/Teams.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

export default function Teams() {
  const navigate = useNavigate();

  const [checkingTeam, setCheckingTeam] = useState(true);

  const [teamName, setTeamName] = useState("");
  const [teamJustCreated, setTeamJustCreated] = useState(false);
  const [teamPassword, setTeamPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [message, setMessage] = useState("");
  const [warn, setWarn] = useState("");
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // -------------------------
  // Check if user already has a team
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    const checkTeam = async () => {
      try {
        const res = await api.get("/teams/myteam");
        if (cancelled) return;

        if (res.status === 200) {
          if (!teamJustCreated) {
            navigate(`/team/${res.data.team_name}`);
            return;
          }
        }
      } catch (err) {
        if (cancelled) return;
        // 404 -> no team; anything else is worth logging
        if (err.response?.status !== 404) {
          console.error("Failed checking team:", err);
          setWarn(
            "Temporary issue while checking team status. You can still try creating a team."
          );
        }
      }

      if (!cancelled) setCheckingTeam(false);
    };

    checkTeam();
    return () => {
      cancelled = true;
    };
  }, [navigate, teamJustCreated]);

  // -------------------------
  // Input rules (UX)
  // -------------------------
  const trimmedName = useMemo(() => teamName.trim(), [teamName]);
  const passLen = teamPassword.length;

  const nameOk = trimmedName.length >= 3;
  const passOk = passLen >= 8;

  const canCreate = !checkingTeam && !submitting && nameOk && passOk;

  const nameHint = useMemo(() => {
    if (!teamName) return "required";
    if (!nameOk) return "min 3 characters";
    return "ok";
  }, [teamName, nameOk]);

  const passHint = useMemo(() => {
    if (!teamPassword) return "required";
    if (!passOk) return "min 8 characters";
    return "ok";
  }, [teamPassword, passOk]);

  // -------------------------
  // Create team
  // -------------------------
  const handleCreateTeam = async (e) => {
    e?.preventDefault?.();

    setMessage("");
    setWarn("");
    setError("");
    setInviteUrl("");
    setCopied(false);

    // hide password after confirmation
    setShowPassword(false);

    if (!trimmedName || !teamPassword) {
      setError("Please enter both team name and password.");
      return;
    }
    if (!nameOk) {
      setError("Team name must be at least 3 characters.");
      return;
    }
    if (!passOk) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post("/teams/create", {
        team_name: trimmedName,
        team_password: teamPassword,
      });

      setTeamJustCreated(true);

      const data = res.data;

      // NEW: fetch invite link from protected endpoint
      const inviteRes = await api.get("/teams/myteam/invite");
      setInviteUrl(inviteRes.data.invite_url);
      setMessage(
        `Team "${data.team_name}" created. Share the invite link to add members.`
      );
      setWarn(
        "Invite links should be treated as credentials. Share only with trusted teammates."
      );
    } catch (err) {
      console.error("Create team error:", err);

      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        setError("You must be logged in to create a team.");
      } else if (status === 400 && detail === "User already in a team") {
        setError("You already belong to a team.");
      } else if (status === 409) {
        setError("A team with this name already exists.");
      } else {
        setError("Failed to create team. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Clipboard blocked. Copy the link manually.");
    }
  };

  // -------------------------
  // Loading screen (check team)
  // -------------------------
  if (checkingTeam) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
        {/* Background (green terminal UI) */}
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

        <div className="relative z-10 mx-auto max-w-3xl px-4">
          <div className="admin-feedback warn" style={{ marginTop: 40 }}>
            Checking your team status…
          </div>
        </div>
      </section>
    );
  }

  // -------------------------
  // Main UI
  // -------------------------
  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      {/* Background (green terminal UI ) */}
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
          <div className="auth-shell">
            {/* Left panel */}
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  secure://pwn-depot • teams
                </div>

                <div className="auth-title">
                  Create
                  <br />
                  <span style={{ color: "rgba(110,255,190,0.95)" }}>
                    your team
                  </span>
                  .
                </div>

                <div className="auth-subtitle">
                  Teams let you collaborate and track progress. After creation,
                  share the invite link with your teammates.
                </div>

                <ul className="auth-bullets">
                  <li>Invite links act like credentials — share carefully.</li>
                  <li>Choose a strong team password (min 8 characters).</li>
                  <li>
                    If you already have a team, you will be redirected
                    automatically.
                  </li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot" />
                  <span>
                    mode: <code>create</code> • scope: <code>team</code>
                  </span>
                </div>
              </div>
            </aside>

            {/* Card */}
            <section className="auth-card">
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>Teams</h2>
                  <div className="auth-mini">operator</div>
                </div>

                {/* Feedback */}
                <Feedback type="error">{error}</Feedback>
                <Feedback type="warn">{warn}</Feedback>
                <Feedback type="success">{message}</Feedback>
                {copied && <Feedback type="success">Invite link copied.</Feedback>}

                {/* Form */}
                <form onSubmit={handleCreateTeam} style={{ marginTop: 10 }}>
                  <label className="admin-field">
                    <div className="admin-label">
                      <span>Team name</span>
                      <span className="admin-hint">{nameHint}</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. shellshockers"
                      value={teamName}
                      onChange={(e) => {
                        setTeamName(e.target.value);
                        if (error) setError("");
                        if (message) setMessage("");
                      }}
                      className="admin-input mono"
                      autoComplete="off"
                      disabled={submitting}
                    />
                  </label>

                  <label className="admin-field">
                    <div className="admin-label">
                      <span>Team password</span>
                      <span className="admin-hint">{passHint}</span>
                    </div>

                    {/* Show/Hide like Register */}
                    <div className="auth-input-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="min 8 characters"
                        value={teamPassword}
                        onChange={(e) => {
                          setTeamPassword(e.target.value);
                          if (error) setError("");
                          if (message) setMessage("");
                        }}
                        className="admin-input mono has-toggle"
                        autoComplete="new-password"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        className="auth-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Hide team password" : "Show team password"
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
                    disabled={!canCreate}
                    style={{ marginTop: 12 }}
                  >
                    {submitting ? "Creating…" : "Create Team"}
                  </button>
                </form>

                {/* Invite block */}
                {inviteUrl && (
                  <div className="team-invite" style={{ marginTop: 14 }}>
                    <div className="admin-label" style={{ marginBottom: 8 }}>
                      <span>Invite link</span>
                      <span className="admin-hint">share with teammates</span>
                    </div>

                    <div className="team-invite-row">
                      <input
                        type="text"
                        value={inviteUrl}
                        readOnly
                        className="admin-input mono team-invite-input"
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn-soft team-invite-btn"
                        onClick={handleCopy}
                      >
                        copy
                      </button>
                    </div>

                    <div className="admin-mini" style={{ marginTop: 10 }}>
                      Tip: anyone with this link can join. Treat it like a password.
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link to="/rankings" className="admin-btn admin-btn-ghost">
                        Scoreboard
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn-soft"
                        onClick={() => {
                          setTeamName("");
                          setTeamPassword("");
                          setShowPassword(false);
                          setInviteUrl("");
                          setCopied(false);
                          setMessage("");
                          setWarn("");
                          setError("");
                        }}
                      >
                        Reset Form
                      </button>
                    </div>
                  </div>
                )}

                {!inviteUrl && (
                  <div className="admin-mini" style={{ marginTop: 12 }}>
                    Already have an invite? Open it and join from the join team page.
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
