// src/pages/CaptainPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../config/api";
import "../index.css";

function Feedback({ type = "warn", children, className = "" }) {
  if (!children) return null;

  const cls =
    type === "error"
      ? "admin-feedback error"
      : type === "success"
      ? "admin-feedback success"
      : "admin-feedback warn";

  return <div className={`${cls} ${className}`.trim()}>{children}</div>;
}

export default function CaptainPanel() {
  const { teamName } = useParams();

  const [team, setTeam] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [newInviteUrl, setNewInviteUrl] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [teamPasswordForDelete, setTeamPasswordForDelete] = useState("");

  const [showNewTeamPass, setShowNewTeamPass] = useState(false);
  const [showAccountPass, setShowAccountPass] = useState(false);
  const [showDeletePass, setShowDeletePass] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("warn"); // success | warn | error
  const [loading, setLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccountPasswordPrompt, setShowAccountPasswordPrompt] = useState(false);

  const resetMessages = () => {
    setMessage("");
    setMessageType("warn");
  };

  const setErr = (txt) => {
    setMessage(txt);
    setMessageType("error");
  };
  const setOk = (txt) => {
    setMessage(txt);
    setMessageType("success");
  };
  const setWarn = (txt) => {
    setMessage(txt);
    setMessageType("warn");
  };

  useEffect(() => {
    const load = async () => {
      resetMessages();
      try {
        const res = await api.get(`/teams/by-name/${encodeURIComponent(teamName)}`);
        setTeam(res.data);

        try {
          const me = await api.get("/users/me");
          setCurrentUser(me.data);
        } catch {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error(err);
        setErr("Team not found.");
        setTeam(null);
      }
    };

    if (teamName) load();
     
  }, [teamName]);

  const safeTeamName = useMemo(() => team?.team_name || teamName || "team", [team, teamName]);

  const isCaptain = useMemo(() => {
    if (!team || !currentUser) return false;
    return team.captain_user_id === currentUser.id;
  }, [team, currentUser]);

  const roleLabel = isCaptain ? "captain" : "user";

  const copyInvite = async () => {
    resetMessages();
    try {
      await navigator.clipboard.writeText(newInviteUrl);
      setOk("Invite link copied to clipboard.");
    } catch (e) {
      console.error(e);
      setErr("Failed to copy invite link.");
    }
  };

  const regenerateInvite = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await api.post(`/teams/actions/${encodeURIComponent(safeTeamName)}/regen-invite`);
      setNewInviteUrl(res.data.invite_url);
      setOk("New invite link generated.");
    } catch (err) {
      console.error(err);
      setErr("Failed to regenerate invite link.");
    }
    setLoading(false);
  };

  const updatePassword = async () => {
    resetMessages();

    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    if (!showAccountPasswordPrompt) {
      setShowAccountPasswordPrompt(true);
      setWarn("Confirm with your account password to apply change.");
      return;
    }

    if (!accountPassword.trim()) {
      setErr("Account password is required.");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/teams/actions/${safeTeamName}/password`, {
        new_password: newPassword,
        account_password: accountPassword,
      });

      setOk("Team password updated.");
      setNewPassword("");
      setAccountPassword("");
      setShowAccountPasswordPrompt(false);
      setShowNewTeamPass(false);
      setShowAccountPass(false);
    } catch (err) {
      console.error(err);

      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.message
          ? detail.message
          : "Failed to update password.";

      setErr(msg);
    }
    setLoading(false);
  };

  const startDelete = () => {
    resetMessages();
    setShowDeleteConfirm(true);
    setTeamPasswordForDelete("");
    setWarn("Confirm deletion by entering the team password.");
  };

  const confirmDelete = async () => {
    resetMessages();

    if (teamPasswordForDelete.length < 8) {
      setErr("Team password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/teams/actions/${safeTeamName}`, {
        data: { team_password: teamPasswordForDelete },
      });
      window.location.href = "/teams";
    } catch (err) {
      console.error(err);
      setErr(err.response?.data?.detail || "Failed to delete team.");
    }
    setLoading(false);
  };

  // Loading / Not found
  if (!team) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
        <TeamBg />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <section className="scoreboard-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Captain Panel</div>
                <div className="scoreboard-card-meta">team: {teamName || "—"}</div>
              </div>
              <div className="scoreboard-badge">sync</div>
            </div>

            <div className="scoreboard-chart-wrap">
              <div className="cp-feedback-wrap">
                <Feedback type={message ? messageType : "warn"} className="cp-feedback">
                  {message || "Fetching team data…"}
                </Feedback>
              </div>

              <div className="team-actions-row team-actions-row--center cp-actions">
                <Link to="/teams" className="team-btn team-btn-ghost">
                  Back to Teams
                </Link>
                <Link to="/rankings" className="team-btn team-btn-ghost">
                  Scoreboard
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      <TeamBg />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <header className="scoreboard-hero">
          <div className="scoreboard-kicker">
            <span className="scoreboard-dot" />
            secure://pwn-depot • captain
          </div>

          <div className="scoreboard-headline">
            <h1 className="scoreboard-title">Captain Panel</h1>
            <p className="scoreboard-subtitle">
              Invite links, password rotation, and team deletion. Use with care.
            </p>
          </div>

          <div className="scoreboard-meta">
            <span className="scoreboard-pill">
              team: <strong>{team.team_name}</strong>
            </span>
            <span className="scoreboard-pill">
              members: <strong>{team.users?.length ?? 0}</strong>
            </span>
            <span className="scoreboard-pill">
              mode: <strong>{roleLabel}</strong>
            </span>
          </div>
        </header>

        {/* GLOBAL FEEDBACK */}
        {message && (
          <section className="scoreboard-card" style={{ marginBottom: 18 }}>
            <div className="scoreboard-chart-wrap">
              <div className="cp-feedback-wrap" style={{ minHeight: 52 }}>
                {message && (
                  <Feedback type={messageType} className="cp-feedback">
                    {message}
                  </Feedback>
                )}
              </div>
            </div>
          </section>
        )}

        {/* INVITE */}
        <section className="scoreboard-card">
          <div className="scoreboard-card-head">
            <div>
              <div className="scoreboard-card-title">Invite link</div>
              <div className="scoreboard-card-meta">regenerate token for new members</div>
            </div>
            <div className="scoreboard-badge">invite</div>
          </div>

          <div className="scoreboard-chart-wrap">
            <div className="team-actions-row team-actions-row--center cp-actions">
              <button className="team-btn" onClick={regenerateInvite} disabled={loading} type="button">
                {loading ? "Working…" : "Generate new link"}
              </button>

              <Link to={`/team/${team.team_name}`} className="team-btn team-btn-ghost">
                Back to Team
              </Link>
            </div>

            {newInviteUrl && (
              <div className="team-invite-box">
                <div className="team-invite-label mono">invite_url</div>

                <div className="team-invite-row">
                  <input className="team-input mono" value={newInviteUrl} readOnly />
                  <button className="team-btn team-btn-ghost" onClick={copyInvite} type="button">
                    Copy
                  </button>
                </div>

                <div className="team-invite-hint">
                  Share only with trusted members. Rotating link invalidates the previous one.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PASSWORD ROTATION */}
        <section className="scoreboard-card">
          <div className="scoreboard-card-head">
            <div>
              <div className="scoreboard-card-title">Rotate team password</div>
              <div className="scoreboard-card-meta">requires account password confirmation</div>
            </div>
            <div className="scoreboard-badge">auth</div>
          </div>

          <div className="scoreboard-chart-wrap">
            <label className="team-modal-field">
              <div className="team-modal-label">
                <span>New team password</span>
                <span className="team-modal-hint">min 8 chars</span>
              </div>

              <div className="admin-input-wrap">
                <input
                  type={showNewTeamPass ? "text" : "password"}
                  className="team-input mono admin-input has-toggle"
                  placeholder="Enter new team password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-toggle"
                  onClick={() => setShowNewTeamPass((v) => !v)}
                  aria-label={showNewTeamPass ? "Hide password" : "Show password"}
                >
                  {showNewTeamPass ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {showAccountPasswordPrompt && (
              <label className="team-modal-field" style={{ marginTop: 12 }}>
                <div className="team-modal-label">
                  <span>Account password</span>
                  <span className="team-modal-hint">required</span>
                </div>

                <div className="admin-input-wrap">
                  <input
                    type={showAccountPass ? "text" : "password"}
                    className="team-input mono admin-input has-toggle"
                    placeholder="Confirm with account password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-toggle"
                    onClick={() => setShowAccountPass((v) => !v)}
                    aria-label={showAccountPass ? "Hide password" : "Show password"}
                  >
                    {showAccountPass ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            )}

            <div className="team-actions-row team-actions-row--center cp-actions" style={{ marginTop: 14 }}>
              <button className="team-btn" onClick={updatePassword} disabled={loading} type="button">
                {showAccountPasswordPrompt ? "Confirm rotation" : "Rotate password"}
              </button>

              {showAccountPasswordPrompt && (
                <button
                  className="team-btn team-btn-ghost"
                  type="button"
                  onClick={() => {
                    setShowAccountPasswordPrompt(false);
                    setAccountPassword("");
                    setShowAccountPass(false);
                    setWarn("Password confirmation cancelled.");
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section className="scoreboard-card team-actions-card">
          <div className="scoreboard-card-head">
            <div>
              <div className="scoreboard-card-title">Danger zone</div>
              <div className="scoreboard-card-meta">irreversible actions</div>
            </div>
            <div className="scoreboard-badge">danger</div>
          </div>

          <div className="scoreboard-chart-wrap">
            <div className="team-actions-row team-actions-row--center cp-actions">
              <button
                className="team-btn team-btn-danger"
                onClick={startDelete}
                disabled={loading}
                type="button"
              >
                Delete team
              </button>
            </div>

            {showDeleteConfirm && (
              <div className="team-invite-box" style={{ marginTop: 14 }}>
                <div className="team-invite-label mono">confirm_delete</div>

                <label className="team-modal-field" style={{ marginTop: 10 }}>
                  <div className="team-modal-label">
                    <span>Team password</span>
                    <span className="team-modal-hint">required</span>
                  </div>

                  <div className="admin-input-wrap">
                    <input
                      type={showDeletePass ? "text" : "password"}
                      className="team-input mono admin-input has-toggle"
                      placeholder="Enter team password to confirm"
                      value={teamPasswordForDelete}
                      onChange={(e) => setTeamPasswordForDelete(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-toggle"
                      onClick={() => setShowDeletePass((v) => !v)}
                      aria-label={showDeletePass ? "Hide password" : "Show password"}
                    >
                      {showDeletePass ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <div className="team-actions-row team-actions-row--center cp-actions" style={{ marginTop: 12 }}>
                  <button className="team-btn team-btn-danger" onClick={confirmDelete} disabled={loading} type="button">
                    {loading ? "Working…" : "Confirm delete"}
                  </button>
                  <button
                    className="team-btn team-btn-ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setTeamPasswordForDelete("");
                      setShowDeletePass(false);
                      setWarn("Delete cancelled.");
                    }}
                    disabled={loading}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>

                <div className="team-invite-hint">
                  This will permanently remove the team and its state. No undo.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer nav */}
        <section className="scoreboard-card">
          <div className="scoreboard-chart-wrap">
            <div className="cp-center-row">
              <Link to="/teams" className="team-btn team-btn-ghost">
                Back to Teams
              </Link>
              <Link to={`/team/${team.team_name}`} className="team-btn team-btn-ghost">
                Back to Team Page
              </Link>
              <Link to="/rankings" className="team-btn team-btn-ghost">
                Scoreboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function TeamBg() {
  return (
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
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.12)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.92)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/12 via-[#050a07]/55 to-[#050a07]/84" />
      <div className="absolute inset-0 bg-[#050a07]/32" />
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
  );
}
