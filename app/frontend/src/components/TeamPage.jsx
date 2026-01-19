// src/pages/TeamPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../config/api";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
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

export default function TeamPage() {
  const { teamName } = useParams();
  const [teamPasswordForDelete, setTeamPasswordForDelete] = useState("");
  const [showTeamDeletePass, setShowTeamDeletePass] = useState(false);
  const [team, setTeam] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState(false);
  const [selectedNewCaptain, setSelectedNewCaptain] = useState(null);

  const COLORS = useMemo(
    () => ["#22c55e", "#facc15", "#ef4444", "#3b82f6", "#a855f7"],
    []
  );

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName]);

  useEffect(() => {
    if (showModal) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [showModal]);

  const isLoggedIn = !!currentUser;

  const isCaptain = useMemo(() => {
    if (!team || !currentUser) return false;
    return team.captain_user_id === currentUser.id;
  }, [team, currentUser]);

  // Is the logged-in user actually a member of this team (from URL)?
  const isMemberOfThisTeam = useMemo(() => {
    if (!team || !currentUser) return false;
    return team.users?.some((u) => u.username === currentUser.username);
  }, [team, currentUser]);

  const loadTeam = async () => {
    try {
      // Team endpoint is public
      const res = await api.get(`/teams/by-name/${teamName}`);
      const data = res.data;

      setTeam(data);
      setNotFound(false);

      // /users/me is optional: if 401 -> treat as guest
      try {
        const me = await api.get("/users/me");
        setCurrentUser(me.data);
      } catch {
        setCurrentUser(null);
      }

      // Pie aggregation
      const categoryMap = {};
      data.scores.forEach((entry) => {
        const cat = entry.challenge_category || "Misc";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      });

      const formatted = Object.entries(categoryMap).map(([name, count], idx) => ({
        name,
        value: count,
        color: COLORS[idx % COLORS.length],
      }));

      setChartData(formatted);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    }
  };

  // -----------------------------
  // Actions (same backend behavior)
  // -----------------------------
  const leaveTeamNow = async () => {
    try {
      await api.put("/teams/leave");
      window.location.href = "/teams";
    } catch (err) {
      console.error(err);
      setModalMessage("Failed to leave team.");
      setModalError(true);
    }
  };

  const deleteTeamNow = async () => {
    setShowTeamDeletePass(false);
    if (teamPasswordForDelete.length < 8) {
      setModalMessage("Team password must be at least 8 characters.");
      setModalError(true);
      return;
    }

    try {
      await api.delete(`/teams/actions/${team.team_name}`, {
        data: { team_password: teamPasswordForDelete },
      });

      setModalMessage("Team deleted successfully! Redirecting…");
      setModalError(false);
      setTimeout(() => (window.location.href = "/teams"), 1200);
    } catch (err) {
      setModalMessage(err.response?.data?.detail || "Failed to delete team.");
      setModalError(true);
    }
  };

  const transferCaptainAndLeave = async () => {
    if (!selectedNewCaptain) {
      setModalMessage("Select a user to transfer captain role.");
      setModalError(true);
      return;
    }

    try {
      await api.post(`/teams/actions/${team.team_name}/transfer-captain`, {
        new_captain_username: selectedNewCaptain,
      });

      await api.put("/teams/leave");
      window.location.href = "/teams";
    } catch (err) {
      console.error(err);
      setModalMessage(err.response?.data?.detail || "Failed to transfer captain role.");
      setModalError(true);
    }
  };

  const openLeaveModal = () => {
    if (!team || !currentUser) return;

    setModalMessage("");
    setModalError(false);
    setTeamPasswordForDelete("");
    setSelectedNewCaptain(null);
    setShowTeamDeletePass(false);

    const memberCount = team.users.length;

    if (isCaptain && memberCount === 1) setModalType("captain_alone");
    else if (isCaptain && memberCount > 1) setModalType("captain_transfer");
    else setModalType("member_leave");

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setModalMessage("");
    setModalError(false);
    setTeamPasswordForDelete("");
    setSelectedNewCaptain(null);
    setShowTeamDeletePass(false);
  };

  // -----------------------------
  // Not found / loading
  // -----------------------------
  if (notFound) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
        <TeamBg />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <section className="scoreboard-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Team not found</div>
                <div className="scoreboard-card-meta">invalid or removed</div>
              </div>
              <div className="scoreboard-badge">404</div>
            </div>
            <div className="scoreboard-chart-wrap">
              <div className="team-actions-row team-actions-row--center">
                <Link to="/" className="team-btn team-btn-ghost">
                  Back to Home
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (!team) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
        <TeamBg />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <section className="scoreboard-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Loading team…</div>
                <div className="scoreboard-card-meta">fetching telemetry</div>
              </div>
              <div className="scoreboard-badge">sync</div>
            </div>
            <div className="scoreboard-chart-wrap">
              <div className="admin-feedback warn" style={{ marginTop: 8 }}>
                Contacting backend…
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  // -----------------------------
  // UI (Rankings-style)
  // -----------------------------
  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      <TeamBg />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO like Rankings */}
        <header className="scoreboard-hero">
          <div className="scoreboard-kicker">
            <span className="scoreboard-dot" />
            secure://pwn-depot • team
          </div>

          <div className="scoreboard-headline">
            <h1 className="scoreboard-title">{team.team_name}</h1>
            <p className="scoreboard-subtitle">
              Members, total score, and category breakdown. Captain actions available when eligible.
            </p>
          </div>

          <div className="scoreboard-meta">
            <span className="scoreboard-pill">
              total score: <strong>{team.total_score}</strong>
            </span>
            <span className="scoreboard-pill">
              members: <strong>{team.users?.length ?? 0}</strong>
            </span>
            <span className="scoreboard-pill">
              role:{" "}
              <strong>
                {!isLoggedIn ? "guest" : isCaptain ? "captain" : isMemberOfThisTeam ? "member" : "viewer"}
              </strong>
            </span>
          </div>
        </header>

        {/* BIG CHART CARD */}
        <section className="scoreboard-card">
          <div className="scoreboard-card-head">
            <div>
              <div className="scoreboard-card-title">Category breakdown</div>
              <div className="scoreboard-card-meta">completed challenges by category</div>
            </div>
            <div className="scoreboard-badge">donut</div>
          </div>

          {/* PIE CHART */}
          <div className="team-chart-wrap">
            {chartData.length === 0 ? (
              <div className="team-empty">
                <div className="team-empty-title">No completed challenges yet</div>
                <div className="team-empty-subtitle">
                  When your team solves challenges, breakdown will appear here.
                </div>
              </div>
            ) : (
              <div
                className="team-chart-canvas"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setCursor({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
              >
                <ResponsiveContainer width="100%" height={360}>
                  <PieChart>
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];

                        return (
                          <div
                            className="team-tooltip"
                            style={{
                              left: cursor.x + 14,
                              top: cursor.y + 14,
                            }}
                          >
                            <div className="team-tooltip-title">
                              <span
                                className="team-tooltip-swatch"
                                style={{ background: p.payload.color }}
                              />
                              {p.name}
                            </div>
                            <div className="team-tooltip-body">
                              solved: <strong>{p.value}</strong>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={92}
                      outerRadius={128}
                      paddingAngle={2}
                      stroke="rgba(255,255,255,0.16)"
                      strokeWidth={1}
                      isAnimationActive={true}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>

                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(235,255,245,0.92)"
                      style={{ fontWeight: 900, fontSize: 18 }}
                    >
                      {chartData.reduce((s, x) => s + (x.value || 0), 0)}
                    </text>
                    <text
                      x="50%"
                      y="50%"
                      dy={22}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(200,255,235,0.62)"
                      style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.12em" }}
                    >
                      TOTAL SOLVES
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="team-legend">
                {chartData
                  .slice()
                  .sort((a, b) => (b.value || 0) - (a.value || 0))
                  .map((x) => (
                    <div key={x.name} className="team-legend-item">
                      <span className="team-legend-swatch" style={{ background: x.color }} />
                      <span className="team-legend-name">{x.name}</span>
                      <span className="team-legend-val mono">{x.value}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* TEAM MEMBERS */}
        <section className="scoreboard-card scoreboard-card-table">
          <div className="scoreboard-card-head">
            <div>
              <div className="scoreboard-card-title">Team members</div>
              <div className="scoreboard-card-meta">user • score</div>
            </div>
            <div className="scoreboard-badge">list</div>
          </div>

          <div className="scoreboard-table-wrap">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th className="right">Score</th>
                </tr>
              </thead>
              <tbody>
                {team.users.map((u) => (
                  <tr key={u.username}>
                    <td>
                      <Link to={`/profile/${u.username}`} className="team-member-link">
                        {u.username}
                      </Link>
                    </td>
                    <td className="right mono">{u.score ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ACTIONS */}
        {isLoggedIn ? (
          <section className="scoreboard-card team-actions-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Actions</div>
                <div className="scoreboard-card-meta">leave / navigation / captain tools</div>
              </div>
              <div className="scoreboard-badge">ops</div>
            </div>

            <div className="team-actions-row team-actions-row--center">
              {isMemberOfThisTeam && (
                <button type="button" className="team-btn team-btn-danger" onClick={openLeaveModal}>
                  Leave Team
                </button>
              )}

              <Link to="/Rankings" className="team-btn team-btn-ghost">
                Back to Scoreboard
              </Link>

              {isCaptain && (
                <Link to={`/captain-panel/${team.team_name}`} className="team-btn">
                  Captain Panel
                </Link>
              )}
            </div>
          </section>
        ) : (
          <section className="scoreboard-card team-actions-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Actions</div>
                <div className="scoreboard-card-meta">view-only mode</div>
              </div>
              <div className="scoreboard-badge">guest</div>
            </div>

            <div className="team-actions-row team-actions-row--center">
              <Link to="/Rankings" className="team-btn team-btn-ghost">
                Back to Scoreboard
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* MODAL (only when logged in + user is a member) */}
      {isLoggedIn && isMemberOfThisTeam && showModal && (
        <div className="team-modal-overlay" role="dialog" aria-modal="true">
          <div className="team-modal">
            <div className="team-modal-head">
              <div>
                <div className="team-modal-title">
                  {modalType === "captain_alone"
                    ? "Delete Team?"
                    : modalType === "captain_transfer"
                    ? "Transfer Captain Role"
                    : "Leave Team?"}
                </div>
                <div className="team-modal-meta">
                  {modalType === "captain_alone"
                    ? "danger zone • permanent action"
                    : modalType === "captain_transfer"
                    ? "handoff required • then leave"
                    : "confirm action"}
                </div>
              </div>

              <button className="team-icon-btn" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="team-modal-body">
              {modalType === "captain_alone" && (
                <>
                  <p className="team-modal-text">
                    You are the only member. Leaving will <strong>DELETE the team permanently</strong>.
                  </p>

                  <label className="team-modal-field">
                    <div className="team-modal-label">
                      <span>Team password</span>
                      <span className="team-modal-hint">min 8 characters</span>
                    </div>

                    <div className="admin-input-wrap">
                      <input
                        type={showTeamDeletePass ? "text" : "password"}
                        className="team-input mono admin-input has-toggle"
                        placeholder="Enter team password"
                        value={teamPasswordForDelete}
                        onChange={(e) => setTeamPasswordForDelete(e.target.value)}
                      />
                      <button
                        type="button"
                        className="admin-toggle"
                        onClick={() => setShowTeamDeletePass((v) => !v)}
                        aria-label={showTeamDeletePass ? "Hide password" : "Show password"}
                      >
                        {showTeamDeletePass ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>

                  <Feedback type={modalError ? "error" : "success"} className="team-modal-feedback">
                    {modalMessage}
                  </Feedback>
                </>
              )}

              {modalType === "captain_transfer" && (
                <>
                  <p className="team-modal-text">Select a new captain before leaving this team.</p>

                  <label className="team-modal-field">
                    <div className="team-modal-label">
                      <span>New captain</span>
                      <span className="team-modal-hint">required</span>
                    </div>

                    <select
                      className="team-input"
                      value={selectedNewCaptain || ""}
                      onChange={(e) => setSelectedNewCaptain(e.target.value)}
                    >
                      <option value="">Select a user</option>
                      {team.users
                        .filter((u) => u.username !== currentUser?.username)
                        .map((u) => (
                          <option key={u.username} value={u.username}>
                            {u.username}
                          </option>
                        ))}
                    </select>
                  </label>

                  <Feedback type={modalError ? "error" : "warn"} className="team-modal-feedback">
                    {modalMessage}
                  </Feedback>
                </>
              )}

              {modalType === "member_leave" && (
                <>
                  <p className="team-modal-text">Are you sure you want to leave this team?</p>

                  <Feedback type={modalError ? "error" : "warn"} className="team-modal-feedback">
                    {modalMessage}
                  </Feedback>
                </>
              )}
            </div>

            <div className="team-modal-actions">
              {modalType === "captain_alone" && (
                <button className="team-btn team-btn-danger" onClick={deleteTeamNow}>
                  Delete Team
                </button>
              )}

              {modalType === "captain_transfer" && (
                <button className="team-btn" onClick={transferCaptainAndLeave}>
                  Transfer & Leave
                </button>
              )}

              {modalType === "member_leave" && (
                <button className="team-btn team-btn-danger" onClick={leaveTeamNow}>
                  Leave
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TeamBg() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
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