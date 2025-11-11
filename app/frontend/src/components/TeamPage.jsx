// TeamPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import "../index.css";

export default function TeamPage() {
  const { teamName } = useParams();

  // State to store the current team object based on URL param
  const [team, setTeam] = useState(null);
  // Aggregated challenge progress across all team members
  const [teamChallenges, setTeamChallenges] = useState([]);

  // Hardcoded sample data; in a real app, fetch this from the backend
  // Backend Note: Team Challenge Aggregation

  // 1. Team Challenge Counting
  // - A challenge counts for the team if **at least one team member** has completed it.
  // - Do **not** count duplicates if multiple members complete the same challenge.
  // - Only track **categories** (e.g., Crypto, Web, Pwn, Forensics) and increment by 1 per category when at least one member completes it.

  // 2. Suggested Data Structure
  // ```json
  //  [
  //    { "category": "Crypto", "count": 1 },
  //    { "category": "Web", "count": 1 },
  //    { "category": "Pwn", "count": 1 },
  //    { "category": "Forensics", "count": 1 }
  //  ]
  const teams = [
    {
      name: "CryptoMasters",
      users: [
        {
          username: "Alice",
          score: 120,
          challengesCompleted: [
            { name: "Crypto", value: 4, color: "#22c55e" },
            { name: "Web", value: 3, color: "#facc15" },
            { name: "Pwn", value: 2, color: "#ef4444" },
            { name: "Forensics", value: 1, color: "#3b82f6" },
          ],
        },
        {
          username: "Bob",
          score: 80,
          challengesCompleted: [
            { name: "Crypto", value: 4, color: "#22c55e" },
            { name: "Web", value: 3, color: "#facc15" },
            { name: "Pwn", value: 2, color: "#ef4444" },
            { name: "Forensics", value: 1, color: "#3b82f6" },
          ],
        },
      ],
    },
    {
      name: "WebWizards",
      users: [
        {
          username: "Charlie",
          score: 95,
          challengesCompleted: [
            { name: "Crypto", value: 4, color: "#22c55e" },
            { name: "Web", value: 3, color: "#facc15" },
            { name: "Pwn", value: 2, color: "#ef4444" },
            { name: "Forensics", value: 1, color: "#3b82f6" },
          ],
        },
        {
          username: "Dave",
          score: 60,
          challengesCompleted: [
            { name: "Crypto", value: 4, color: "#22c55e" },
            { name: "Web", value: 3, color: "#facc15" },
            { name: "Pwn", value: 2, color: "#ef4444" },
            { name: "Forensics", value: 1, color: "#3b82f6" },
          ],
        },
      ],
    },
  ];

  // When the teamName URL param changes:
  // 1. Find the team in the hardcoded data
  // 2. Aggregate challenges across all users in the team
  //    - For each challenge category, take the max value across all team members
  useEffect(() => {
    const foundTeam = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );
    setTeam(foundTeam || null);

    if (foundTeam && foundTeam.users.length > 0) {
      const categoryMap = {};

      foundTeam.users.forEach((user) => {
        user.challengesCompleted.forEach((ch) => {
          if (!categoryMap[ch.name]) {
            categoryMap[ch.name] = { ...ch }; // Copy first occurrence
          } else {
            // Take the maximum value if another user has a higher value
            categoryMap[ch.name].value = Math.max(categoryMap[ch.name].value, ch.value);
          }
        });
      });

      setTeamChallenges(Object.values(categoryMap));
    } else {
      // No users or no challenges
      setTeamChallenges([]);
    }
  }, [teamName]);

  // Team not found fallback
  if (!team) {
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="gradient-text">Team not found</h2>
          <Link to="/Rankings" className="fancy-btn">
            Back to Scoreboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card profile-card">
        {/* Team Name */}
        <h2 className="profile-username">{team.name}</h2>

        {/* Team Members Table */}
        <div className="profile-stats">
          <h3>Team Members</h3>
          <div className="scoreboard-table-wrapper">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {team.users.map((user) => (
                  <tr className="hover-row" key={user.username}>
                    <td>
                      <Link
                        to={`/profile/${user.username}`}
                        className="username-link transition-colors duration-200"
                      >
                        {user.username}
                      </Link>
                    </td>
                    <td>{user.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Challenges Pie Chart */}
        <div className="profile-chart">
          {teamChallenges.length === 0 ? (
            <p>No challenges completed yet for this team.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={teamChallenges}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ value }) => value} // Only display numeric value
                >
                  {teamChallenges.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  payload={teamChallenges.map((item) => ({
                    value: item.name,
                    type: "square",
                    id: item.name,
                    color: item.color,
                  }))}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Back Button */}
        <div className="profile-footer">
          <Link to="/Rankings" className="fancy-btn">
            Back to Scoreboard
          </Link>
        </div>
      </div>
    </div>
  );
}