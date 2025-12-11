// JoinTeam.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "../config/api";

export default function JoinTeam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [teamName, setTeamName] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setMessage("Invalid team invite link.");
      return;
    }

    // CALL BACKEND PREVIEW ENDPOINT
    api
      .get(`/teams/join?token=${token}`)
      .then((res) => {
        setTeamName(res.data.team_name);
      })
      .catch(() => {
        setMessage("Invite link not recognized.");
      });
  }, [token]);

  const handleJoin = async () => {
    if (enteredPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      const res = await api.post("/teams/join", {
        token: token,
        password: enteredPassword,
      });

      setMessage(`You have successfully joined ${res.data.team_name}!`);

      setTimeout(() => navigate(`/`), 1000);
    } catch (err) {
      if (err.response?.status === 401) {
        setMessage("Incorrect team password.");
      } else {
        setMessage(err.response?.data?.detail || "Failed to join team.");
      }
    }
  };

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">Join Team</h2>

        {message.includes("successfully") ? (
          <p className="success-text">{message}</p>
        ) : (
          <>
            <div className="profile-stats">
              <p>
                Joining team: <strong>{teamName || "..."}</strong>
              </p>

              <input
                type="password"
                placeholder="Team Password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
              />

              <button
                onClick={handleJoin}
                disabled={enteredPassword.length < 8}
                className="enabled-animation"
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
