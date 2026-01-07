// Profile.jsx
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../config/api";

export default function Profile({ loggedInUser }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [challengeData, setChallengeData] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isRecovery = loggedInUser?.token_data?.mfa_recovery === true;
  const isOwnProfile =
    loggedInUser && user && loggedInUser.username === user.username;
  const hasMfa = user?.mfa_enabled === true;

  const PIE_COLORS = [
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#ef4444",
    "#a855f7",
  ];

  useEffect(() => {
    const loadProfile = async () => {
      console.log("PROFILE loggedInUser =", loggedInUser);
      try {
        // 1) Fetch user basic info by USERNAME
        const userRes = await api.get(`/users/profile/${username}`);
        setUser(userRes.data);
        setNotFound(false);

        // 2) Fetch solved challenges by category (API may not exist yet)
        try {
          const challRes = await api.get(`/challenges/user/${username}/solved`);
          const solved = challRes.data || [];

          const formattedData = solved.map((item, index) => ({
            name: item.category,
            value: item.count,
            color: PIE_COLORS[index % PIE_COLORS.length],
          }));

          setChallengeData(formattedData);
        } catch (err) {
          console.warn("Challenge stats not available yet.");
          setChallengeData([]);
        }
      } catch (err) {
        console.error("Profile load error:", err);
        setNotFound(true);
        setUser(null);
      }
    };

    loadProfile();
  }, [username]);

  // Display if user doesn't exist
  if (notFound) {
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="profile-username">User not found</h2>
          <Link to="/" className="fancy-btn">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!user) return <p>Loading...</p>;

  const totalSolved = challengeData.reduce((sum, c) => sum + c.value, 0);

  return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="profile-username">{user.username}</h2>

          {/* USER DETAILS */}
          <div className="profile-stats">
            <p><strong>Score:</strong> {user.score ?? 0}</p>

            <p>
              <strong>Team:</strong>{" "}
              {user.team_name ? (
                  <Link
                      to={`/team/${user.team_name}`}
                      className="team-link"
                      style={{color: "#facc15"}}
                  >
                    {user.team_name}
                  </Link>
              ) : (
                  <span style={{color: "#bbb"}}>No team</span>
              )}
            </p>


            <p>
              <strong>Total Challenges Solved:</strong>{" "}
              {totalSolved > 0 ? totalSolved : "No challenges completed yet"}
            </p>
          </div>

          {/* PIE CHART */}
          {totalSolved > 0 && (
              <div className="profile-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                        data={challengeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                    >
                      {challengeData.map((entry, index) => (
                          <Cell key={index} fill={entry.color}/>
                      ))}
                    </Pie>
                    <Tooltip/>
                    <Legend/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
  )
}

    {isOwnProfile && (
      <div className="profile-stats">
        <h3>Security</h3>

        {isRecovery ? (
          <button
            onClick={() => navigate("/mfa/reset")}
            className="danger-btn danger-btn-profile"
          >
            Reset MFA
          </button>
        )
        : (
          <Link to="/mfa/setup" className="fancy-btn">
            Enable Two-Factor Auth
          </Link>
        )}
      </div>
    )}



  <div className="profile-footer">
    <Link to="/Rankings" className="fancy-btn">Back to Scoreboard</Link>
  </div>
</div>
</div>
)
  ;
}
