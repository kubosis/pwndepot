// Profile.jsx
import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { API_BASE_URL } from "../config/api.jsx";

export default function Profile({ loggedinUser, authToken }) {
  const { username } = useParams();
  const [user, setUser] = useState(null); // Current user object
  const [challengeData, setChallengeData] = useState([]); // Challenge statistics for pie chart

  useEffect(() => {
    // if there's no token we don't call the backend
    if (!authToken) return;

    const loadProfile = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/users/profile/${loggedinUser?.id}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!res.ok) {
          setUser(null);
          setChallengeData([]);
          return;
        }

        const data = await res.json();

        // backend user
        setUser(data);

        // backend doesnt yet return challenge stats, temporarily empty
        setChallengeData([]);
      } catch (err) {
        console.error("Profile load error:", err);
        setUser(null);
        setChallengeData([]);
      }
    };

    loadProfile();
  }, [authToken, loggedinUser]);

  if (!user) {
    // Render "User not found" page
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="profile-username">User not found</h2>
          <div className="profile-footer">
            <Link to="/" className="fancy-btn">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate total challenges completed
  const totalChallengesCompleted = challengeData.reduce(
    (sum, c) => sum + c.value,
    0
  );

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">{user.username}</h2>

        <div className="profile-stats">
          <p><strong>Score:</strong> {user.score}</p>

          {/* Display challenges completed; show message if none */}
          <p>
            <strong>Challenges Completed:</strong>{" "}
            {totalChallengesCompleted > 0 ? totalChallengesCompleted : "No challenges completed yet"}
          </p>

          {/* Team display: clickable link only if user has a team */}
          <p>
            <strong>Team:</strong>{" "}
            {user.team ? (
              <Link
                to={`/team/${user.team}`}
                className="team-link"
                style={{ color: "#facc15", transition: "color 0.3s" }}
                onMouseEnter={(e) => (e.target.style.color = "#22c55e")}
                onMouseLeave={(e) => (e.target.style.color = "#facc15")}
              >
                {user.team}
              </Link>
            ) : (
              <span style={{ color: "#bbb" }}>No team</span>
            )}
          </p>
        </div>

        {/* Render pie chart only if user completed challenges */}
        {totalChallengesCompleted > 0 && (
          <div className="profile-chart">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={challengeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {challengeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  payload={challengeData.map((item) => ({
                    value: item.name,
                    type: "square",
                    id: item.name,
                    color: item.color,
                  }))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="profile-footer">
          <Link to="/Rankings" className="fancy-btn">Back to Scoreboard</Link>
        </div>
      </div>
    </div>
  );
}