import { useParams } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { api } from "../config/api";
import "../index.css";

export default function CaptainPanel() {
  const { teamName } = useParams();   // comes from /captain-panel/:teamName
  const [team, setTeam] = useState(null);

  console.log("team.team_name in CaptainPanel:", team?.team_name);
  const [newInviteUrl, setNewInviteUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamPasswordForDelete, setTeamPasswordForDelete] = useState("");

  const [showAccountPasswordPrompt, setShowAccountPasswordPrompt] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");

  const resetMessages = () => {
    setMessage("");
    setIsError(false);
  };

  // Load team by name from backend
  useEffect(() => {
    const loadTeam = async () => {
      resetMessages();
      try {
        const res = await api.get(`/teams/by-name/${encodeURIComponent(teamName)}`);
        setTeam(res.data);
      } catch (err) {
        console.error("Failed to load team:", err);
        setMessage("Team not found.");
        setIsError(true);
      }
    };

    if (teamName) {
      loadTeam();
    }
  }, [teamName]);

  // While loading / if not found
  if (!team) {
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="profile-username">Captain Panel</h2>
          <p>{message || "Loading team data..."}</p>
        </div>
      </div>
    );
  }
  const copyInvite = async () => {
    resetMessages();
    try {
      await navigator.clipboard.writeText(newInviteUrl);
      setMessage("Invite link copied!");
      setIsError(false);
    } catch (e) {
      console.error(e);
      setMessage("Failed to copy.");
      setIsError(true);
    }
  };

  // -------------------------
  // REGENERATE INVITE LINK
  // -------------------------
  const regenerateInvite = async () => {
    resetMessages();
    setLoading(true);

    try {
      const res = await api.post(`/teams/actions/${encodeURIComponent(team.team_name)}/regen-invite`);
      setNewInviteUrl(res.data.invite_url);
      setMessage("New invite link generated!");
      setIsError(false);
    } catch (err) {
      console.error(err);
      setMessage("Failed to regenerate invite link.");
      setIsError(true);
    }

    setLoading(false);
  };

  // -------------------------
  // CHANGE TEAM PASSWORD
  // -------------------------
  const updatePassword = async () => {
    resetMessages();

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setIsError(true);
      return;
    }

    if (!showAccountPasswordPrompt) {
      setShowAccountPasswordPrompt(true);
      setMessage("Please confirm with your account password.");
      setIsError(false);
      return;
    }

    if (!accountPassword.trim()) {
      setMessage("Account password is required.");
      setIsError(true);
      return;
    }

    setLoading(true);
    try {
      await api.put(`/teams/actions/${team.team_name}/password`, {
        new_password: newPassword,
        account_password: accountPassword,
      });
      setMessage("Team password updated!");
      setIsError(false);
      setNewPassword("");
      setAccountPassword("");
      setShowAccountPasswordPrompt(false);
    } catch (err) {
      console.error(err);
      setMessage("Failed to update password.");
      setIsError(true);
    }

    setLoading(false);
  };

  // -------------------------
  // DELETE TEAM
  // -------------------------
  const startDelete = () => {
    resetMessages();
    setShowDeleteConfirm(true);
    setMessage("Please confirm by entering the team password.");
    setIsError(false);
  };

  const confirmDelete = async () => {
    resetMessages();

    if (teamPasswordForDelete.length < 8) {
      setMessage("Team password must be at least 8 characters.");
      setIsError(true);
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/teams/actions/${team.team_name}`, {
        data: { team_password: teamPasswordForDelete }
      });
      window.location.href = "/teams";
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete team.");
      setIsError(true);
    }

    setLoading(false);
  };

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">Captain Panel – {team.team_name}</h2>

        {/* REGENERATE INVITE LINK */}
        <div className="profile-stats">
          <h3>Generate New Invite Link</h3>

          <button
            className="fancy-btn"
            onClick={regenerateInvite}
            disabled={loading}
          >
            {loading ? "Working..." : "Generate"}
          </button>

          {newInviteUrl && (
            <div style={{ marginTop: "10px" }}>
              <input
                type="text"
                value={newInviteUrl}
                readOnly
                className="readonly-input"
              />

              <button
                className="fancy-btn"
                style={{ marginTop: "5px" }}
                onClick={copyInvite}
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* CHANGE PASSWORD */}
        <div className="profile-stats">
          <h3>Change Team Password</h3>

          <input
            type="password"
            placeholder="New team password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          {showAccountPasswordPrompt && (
            <div style={{ marginTop: "10px" }}>
              <input
                type="password"
                placeholder="Your account password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
              />
            </div>
          )}

          <button
            className="fancy-btn"
            onClick={updatePassword}
            disabled={loading}
            style={{ marginTop: "10px" }}
          >
            {showAccountPasswordPrompt
              ? "Confirm password change"
              : "Update Password"}
          </button>
        </div>

        {/* DANGER ZONE */}
        <div className="profile-stats">
          <h3 className="gradient-text">Danger Zone</h3>

          <button
            className="fancy-btn"
            style={{ backgroundColor: "red", marginTop: "10px" }}
            onClick={startDelete}
            disabled={loading}
          >
            Delete Team
          </button>

          {showDeleteConfirm && (
            <div style={{ marginTop: "10px" }}>
              <input
                type="password"
                placeholder="Team password to confirm"
                value={teamPasswordForDelete}
                onChange={(e) => setTeamPasswordForDelete(e.target.value)}
              />
              <button
                className="fancy-btn"
                style={{ backgroundColor: "red", marginTop: "8px" }}
                onClick={confirmDelete}
                disabled={loading}
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
        {/* BACK BUTTON */}
        <div className="profile-footer" style={{ marginTop: "20px" }}>
          <button
            className="fancy-btn"
            onClick={() => (window.location.href = `/team/${team.team_name}`)}
          >
            Back to Team Page
          </button>
        </div>

        {message && (
          <p
            style={{
              marginTop: "10px",
              color: isError ? "red" : "limegreen",
              fontWeight: "bold",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
