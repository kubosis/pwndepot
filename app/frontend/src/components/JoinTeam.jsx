// JoinTeam.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { hashPassword } from "../utils/passwordUtils";

export default function JoinTeam() {
  const [searchParams] = useSearchParams();
  const [enteredPassword, setEnteredPassword] = useState("");
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamPassword, setTeamPassword] = useState(""); // frontend-only placeholder

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setMessage("Invalid invite link.");
      return;
    }

    // --- Backend note ---
    // In production, fetch team info by token:
    // fetch(`/api/teams/join-info?token=${token}`)
    //   .then(res => res.json())
    //   .then(data => { setTeamName(data.name); /* do NOT send password */ })
    //   .catch(() => setMessage("Invite link not recognized."));

    // Placeholder frontend-only mapping
    const fakeTeams = {
      "abcd1234": { name: "CryptoMasters", password: "password123" },
      "efgh5678": { name: "WebWizards", password: "securepass" },
    };

    if (fakeTeams[token]) {
      setTeamName(fakeTeams[token].name);
      setTeamPassword(fakeTeams[token].password);
    } else {
      setMessage("Invite link not recognized.");
    }
  }, [searchParams]);

  const handleJoin = async () => {

    const hashedPassword = await hashPassword(enteredPassword);

    if (enteredPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    // --- Backend note ---
    // POST /api/teams/join with { token, password }
    // Response: { success: true/false, message, teamName }
    // Backend must compare server-side hash(hashPassword + serverSalt)

    if (hashedPassword === (await hashPassword(teamPassword))) {
      setMessage(`You have successfully joined ${teamName}!`);
    } else {
      setMessage("Incorrect password. Try again.");
    }
  };
  

  const isSubmitDisabled = enteredPassword.trim().length < 8;

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">Join Team</h2>

        {message.includes("successfully") || message.includes("not recognized") ? (
          <p className="profile-stats">{message}</p>
        ) : (
          <>
            <div className="profile-stats">
              <p>
                Enter the password for the team <strong>{teamName}</strong>:
              </p>
              <input
                type="password"
                placeholder="Team Password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
              />
              <button
                onClick={handleJoin}
                className={`enabled-animation`}
                disabled={isSubmitDisabled}
                style={{ cursor: isSubmitDisabled ? "not-allowed" : "pointer" }}
              >
                Join Team
              </button>
            </div>
            {message && <p className="error-text">{message}</p>}
          </>
        )}

        <div className="profile-footer">
          <Link to="/teams" className="fancy-btn">
              Back to Teams
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- Backend note ---
// User can only join a team if he's not in the team