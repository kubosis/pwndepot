// TeamPage.jsx 
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../config/api";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "../index.css";

export default function TeamPage() {
  const { teamName } = useParams();
  const [teamPasswordForDelete, setTeamPasswordForDelete] = useState("");
  const [team, setTeam] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // POPUP STATE
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState(false);
  const [selectedNewCaptain, setSelectedNewCaptain] = useState(null);

  const COLORS = ["#22c55e", "#facc15", "#ef4444", "#3b82f6", "#a855f7"];

  useEffect(() => {
    loadTeam();
  }, [teamName]);

  const loadTeam = async () => {
    try {
      const res = await api.get(`/teams/by-name/${teamName}`);
      const data = res.data;
      const me = await api.get("/users/me");
      setCurrentUser(me.data);

      setTeam(data);
      setNotFound(false);

      // CHART AGGREGATION
      const categoryMap = {};
      data.scores.forEach((entry) => {
        const cat = entry.challenge_category || "Misc";
        if (!categoryMap[cat]) categoryMap[cat] = 0;
        categoryMap[cat] += 1;
      });

      const formatted = Object.entries(categoryMap).map(
        ([name, count], idx) => ({
          name,
          value: count,
          color: COLORS[idx % COLORS.length],
        })
      );

      setChartData(formatted);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    }
  };

  if (notFound)
    return (
      <div className="register-container">
        <div className="register-card profile-card">
          <h2 className="gradient-text">Team not found</h2>
          <Link to="/Rankings" className="fancy-btn">Back</Link>
        </div>
      </div>
    );

  if (!team) return <p>Loading...</p>;

  // ---------------------------------------------
  // HANDLE LEAVING THE TEAM (ALL MODAL CASES)
  // ---------------------------------------------
  const leaveTeamNow = async () => {
    try {
      await api.put("/teams/leave");
      window.location.href = "/teams";
    } catch (err) {
      console.error(err);
      alert("Failed to leave team.");
    }
  };

  const deleteTeamNow = async () => {
    if (teamPasswordForDelete.length < 8) {
      setModalMessage("Team password must be at least 8 characters.");
      setModalError(true);
      return;
    }

    try {
      await api.delete(
        `/teams/actions/${team.team_name}`,
        { data: { team_password: teamPasswordForDelete } }
      );

      setModalMessage("Team deleted successfully!");
      setModalError(false);

      setTimeout(() => window.location.href = "/teams", 1200);

    } catch (err) {
      setModalMessage(err.response?.data?.detail || "Failed to delete team.");
      setModalError(true);
    }
  };


  const transferCaptainAndLeave = async () => {
    if (!selectedNewCaptain) return;

    try {
      // Correct backend call
      await api.post(`/teams/actions/${team.team_name}/transfer-captain`, {
        new_captain_username: selectedNewCaptain,
      });

      // After transfer -> leave
      await api.put("/teams/leave");

      window.location.href = "/teams"; // redirect
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.detail ||
        "Failed to transfer captain role."
      );
    }
  };


  // ---------------------------------------------
  // MODAL HANDLING
  // ---------------------------------------------
  const openLeaveModal = () => {
    const isCaptain = team.captain_user_id === currentUser.id;
    const memberCount = team.users.length;

    if (isCaptain && memberCount === 1) {
      setModalType("captain_alone");
      setShowModal(true);
      document.body.classList.add("modal-open");
    } else if (isCaptain && memberCount > 1) {
      setModalType("captain_transfer");
      setSelectedNewCaptain(null);
      setShowModal(true);
      document.body.classList.add("modal-open");
    } else {
      setModalType("member_leave");
      setShowModal(true);
      document.body.classList.add("modal-open");
    }
  };

  return (
    <div className="register-container">
      <div className="register-card profile-card">

        {/* TEAM NAME */}
        <h2 className="profile-username">{team.team_name}</h2>

        {/* MEMBERS */}
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
                {team.users.map((u) => (
                  <tr className="hover-row" key={u.username}>
                    <td>
                      <Link to={`/profile/${u.username}`} className="username-link">
                        {u.username}
                      </Link>
                    </td>
                    <td>{u.score ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SCORE */}
        <div className="profile-stats">
          <h3>Total Score: {team.total_score}</h3>
        </div>

        {/* PIE CHART */}
        <div className="profile-chart">
          {chartData.length === 0 ? (
            <p>No completed challenges yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ value }) => value}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* FOOTER BUTTONS */}
        <div
          className="profile-footer"
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <button className="fancy-btn" style={{ backgroundColor: "red" }} onClick={openLeaveModal}>
            Leave Team
          </button>

          <Link to="/Rankings" className="fancy-btn">Back to Scoreboard</Link>

          {currentUser &&
            team.captain_user_id === currentUser.id && (
              <Link 
                to={`/captain-panel/${team.team_name}`}
                className="fancy-btn"
              >
                Captain Panel
              </Link>
          )}
        </div>

        {/* MODALS */}
        {showModal && (
          <div className="modal-overlay">
            <div className="register-card profile-card modal-card">

              {/* CASE 1 — Captain alone */}
              {modalType === "captain_alone" && (
                <>
                  <h3 className="gradient-text">Delete Team?</h3>
                  <p>You are the only member. Leaving will <b>DELETE the team permanently</b>.</p>

                  <input 
                    type="password"
                    className="readonly-input"
                    placeholder="Enter team password"
                    value={teamPasswordForDelete}
                    onChange={(e) => setTeamPasswordForDelete(e.target.value)}
                    style={{ marginTop: "10px" }}
                  />

                  {modalMessage && (
                    <p
                      style={{
                        marginTop: "10px",
                        color: modalError ? "red" : "limegreen",
                        fontWeight: "bold",
                        textAlign: "center"
                      }}
                    >
                      {modalMessage}
                    </p>
                  )}
                  <div className="modal-buttons">
                    <button className="fancy-btn" onClick={deleteTeamNow}>Delete Team</button>
                    <button className="fancy-btn" onClick={() => setShowModal(false)}>Cancel</button>
                  </div>
                </>
              )}


              {/* CASE 2 — Captain must transfer */}
              {modalType === "captain_transfer" && (
              <>
                <h3 className="gradient-text">Transfer Captain Role</h3>
                <p>Select a new captain before leaving:</p>

                <select
                  className="readonly-input"
                  style={{ marginTop: "10px" }}
                  value={selectedNewCaptain || ""}
                  onChange={(e) => setSelectedNewCaptain(e.target.value)}
                >
                  <option value="">Select a user</option>

                  {team.users
                    .filter(u => u.username !== currentUser.username) // exclude current captain
                    .map(u => (
                      <option key={u.username} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                </select>

                {modalMessage && (
                  <p
                    style={{
                      marginTop: "10px",
                      color: modalError ? "red" : "limegreen",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {modalMessage}
                  </p>
                )}

                <div className="modal-buttons">
                  <button className="fancy-btn" onClick={transferCaptainAndLeave}>
                    Transfer & Leave
                  </button>
                  <button className="fancy-btn" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}


              {/* CASE 3 — Member leaving */}
              {modalType === "member_leave" && (
                <>
                  <h3 className="gradient-text">Leave Team?</h3>
                  <p>Are you sure you want to leave this team?</p>

                  {modalMessage && (
                    <p
                      style={{
                        marginTop: "10px",
                        color: modalError ? "red" : "limegreen",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      {modalMessage}
                    </p>
                  )}

                  <div className="modal-buttons">
                    <button className="fancy-btn" onClick={leaveTeamNow}>Leave</button>
                    <button className="fancy-btn" onClick={() => setShowModal(false)}>Cancel</button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
