// src/components/Teams.jsx
import React, { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../config/api";

export default function Teams() {
  const [checkingTeam, setCheckingTeam] = useState(true);
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [teamPassword, setTeamPassword] = useState("");

  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
  const checkTeam = async () => {
    try {
      const res = await api.get("/teams/myteam");

      if (res.status === 200) {
        return navigate(`/team/${res.data.team_name}`);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed checking team:", err);
      }
    }

    setCheckingTeam(false); // finished checking
  };

  checkTeam();
}, []);
  if (checkingTeam) {
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="profile-username">Checking your team...</h2>
        </div>
      </div>
    );
  }



  const handleCreateTeam = async () => {
    setMessage("");
    setError("");
    setInviteUrl("");
    setCopied(false);

    if (!teamName || !teamPassword) {
      setError("Please enter both team name and password.");
      return;
    }
    if (teamPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    try {
      const res = await api.post("/teams/create", {
        team_name: teamName,
        team_password: teamPassword,
      });

      const data = res.data;
      setInviteUrl(data.invite_url);

      setMessage(`Team "${data.team_name}" created! Share the link below.`);
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
    }
  };

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">Teams</h2>

        <div className="profile-stats">
          <h3>Create a Team</h3>

          <input
            type="text"
            placeholder="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />

          <input
            type="password"
            placeholder="Team Password (min 8 characters)"
            value={teamPassword}
            onChange={(e) => setTeamPassword(e.target.value)}
          />

          <button onClick={handleCreateTeam} className="enabled-animation">
            Create Team
          </button>
        </div>

        {/* ONLY INVITE URL */}
        {inviteUrl && (
          <div className="profile-stats">
            <h3>Team Invite Link</h3>

            <div className="invite-box">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="readonly-input invite-input"
              />

              <button
                className="fancy-btn invite-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);

                  // Hide "copied" message after 2 seconds
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                Copy
              </button>
            </div>

            {copied && <p className="success-text">Invite link copied!</p>}

            <p>Share this link so others can join your team.</p>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {message && !error && <p className="success-text">{message}</p>}
      </div>
    </div>
  );
}
