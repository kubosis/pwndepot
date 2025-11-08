// Profile.jsx
import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

export default function Profile() {
  const { username } = useParams();
  const [user, setUser] = useState(null); // Current user object
  const [challengeData, setChallengeData] = useState([]); // Challenge statistics for pie chart

  useEffect(() => {
    // --- Backend Note ---
    // Replace mockUsers with a real API call:
    // fetch(`/api/users/${username}`)
    //   .then(res => res.json())
    //   .then(data => {
    //      setUser(data.user);
    //      setChallengeData(data.challenges);
    //   });

    const mockUsers = [
      { username: "Alice", score: 120, team: "CryptoMasters" },
      { username: "Bob", score: 80, team: "CryptoMasters" },
      { username: "Charlie", score: 95, team: "WebWizards" },
      { username: "Dave", score: 60, team: null }, // Example: user without a team
    ];

    // Find the user matching the username in URL
    const foundUser = mockUsers.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (foundUser) {
      setUser(foundUser);

      // Mock challenge data for demonstration
      setChallengeData(foundUser.username === "Dave" ? [] : [
        { name: "Crypto", value: 4, color: "#22c55e" },
        { name: "Web", value: 3, color: "#facc15" },
        { name: "Pwn", value: 2, color: "#ef4444" },
        { name: "Forensics", value: 1, color: "#3b82f6" },
      ]);
    } else {
      // User not found: clear state
      setUser(null);
      setChallengeData([]);
    }
  }, [username]);

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