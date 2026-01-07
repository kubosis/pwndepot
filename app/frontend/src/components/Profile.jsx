// src/pages/Profile.jsx
import { useState, useEffect, useMemo, useState as useReactState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../config/api";
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

const PIE_COLORS = ["#22c55e", "#facc15", "#ef4444", "#3b82f6", "#a855f7"];

export default function Profile({ loggedInUser }) {
  const { username } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [challengeData, setChallengeData] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [mySecurity, setMySecurity] = useState(null);

  const [cursor, setCursor] = useReactState({ x: 0, y: 0 });

  const isOwnProfile =
    loggedInUser && user && loggedInUser.username === user.username;

  // refresh /users/me ONLY for own profile
  useEffect(() => {
    if (!loggedInUser || loggedInUser.username !== username) return;

    api
      .get("/users/me")
      .then((res) => setMySecurity(res.data))
      .catch((err) => console.warn("Could not refresh /users/me:", err));
  }, [loggedInUser, username]);

  const isRecovery =
    (mySecurity?.token_data?.mfa_recovery ??
      loggedInUser?.token_data?.mfa_recovery) === true;

  const mfaEnabled =
    (mySecurity?.mfa_enabled ??
      user?.mfa_enabled ??
      loggedInUser?.mfa_enabled) === true;

  const surfaceTone = mfaEnabled ? "admin-surface--secure" : "";

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userRes = await api.get(`/users/profile/${username}`);
        setUser(userRes.data);
        setNotFound(false);

        try {
          const challRes = await api.get(`/challenges/user/${username}/solved`);
          const solved = challRes.data || [];

          const formatted = solved.map((item, index) => ({
            name: item.category,
            value: item.count,
            color: PIE_COLORS[index % PIE_COLORS.length],
          }));

          setChallengeData(formatted);
        } catch {
          setChallengeData([]);
        }
      } catch {
        setNotFound(true);
        setUser(null);
      }
    };

    loadProfile();
  }, [username]);

  const totalSolved = useMemo(
    () => challengeData.reduce((sum, c) => sum + (c.value || 0), 0),
    [challengeData]
  );

  const canDeleteAccount =
    isOwnProfile &&
    (loggedInUser?.role === "USER" || loggedInUser?.role === "user") &&
    !isRecovery;

  // -----------------------------------------
  // Unified wrappers: NOT FOUND / LOADING
  // -----------------------------------------
  if (notFound) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
        <ProfileBg />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <section className="scoreboard-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">User not found</div>
                <div className="scoreboard-card-meta">
                  profile does not exist or is unavailable
                </div>
              </div>
              <div className="scoreboard-badge">404</div>
            </div>

            <div className="scoreboard-chart-wrap">
              <div className="team-actions-row team-actions-row--center">
                <Link to="/rankings" className="team-btn team-btn-ghost">
                  Back to Scoreboard
                </Link>
                <Link to="/" className="team-btn team-btn-ghost">
                  Home
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
        <ProfileBg />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <section className="scoreboard-card">
            <div className="scoreboard-card-head">
              <div>
                <div className="scoreboard-card-title">Loading profile…</div>
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

  // -----------------------------------------
  // Main UI
  // -----------------------------------------
  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      <ProfileBg />

      <div
        className={`relative z-10 mx-auto max-w-6xl px-4 sm:px-6 ${
          mfaEnabled ? "profile-mfa-on" : ""
        }`}
      >
        {/* Header */}
        <div className="admin-topbar">
          <div>
            <div className={`admin-kicker ${mfaEnabled ? "admin-kicker--secure" : ""}`}>
              <span className={`admin-dot admin-dot-soft ${mfaEnabled ? "admin-dot--secure" : ""}`} />
              secure://pwn-depot • profile
            </div>
            <div className="admin-topbar-title mono">{user.username}</div>
            <div className={`admin-topbar-sub ${mfaEnabled ? "admin-topbar-sub--secure" : ""}`}>
              account overview and activity
            </div>
          </div>

          <div className="admin-actions">
            <Link
              to="/rankings"
              className={`admin-btn admin-btn-ghost ${mfaEnabled ? "admin-btn-ghost--secure" : ""}`}
            >
              Back To Scoreboard
            </Link>
          </div>
        </div>

        {/* Overview */}
        <section className={`admin-surface ${surfaceTone}`}>
          <div className="admin-surface-head">
            <div>
              <div className="admin-surface-title">Overview</div>
              <div className="admin-surface-meta">Public account information</div>
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:grid-cols-3">
            <div>
              <div className="admin-mini">Score</div>
              <div className="admin-h2 mono">{user.score ?? 0}</div>
            </div>

            <div>
              <div className="admin-mini">Team</div>
              {user.team_name ? (
                <Link to={`/team/${user.team_name}`} className="team-link mono footer-link">
                  {user.team_name}
                </Link>
              ) : (
                <div className="admin-mini">No team</div>
              )}
            </div>

            <div>
              <div className="admin-mini">Challenges solved</div>
              <div className="admin-h2 mono">{totalSolved}</div>
            </div>
          </div>
        </section>

        {/* Activity - style donut */}
        <section className={`admin-surface mt-6 ${surfaceTone}`}>
          <div className="admin-surface-head">
            <div>
              <div className="admin-surface-title">Activity</div>
              <div className="admin-surface-meta">Solved challenges by category</div>
            </div>
          </div>

          {totalSolved > 0 ? (
            <div className="team-chart-wrap">
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
                            style={{ left: cursor.x + 14, top: cursor.y + 14 }}
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
                      data={challengeData}
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
                      {challengeData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
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
                      {totalSolved}
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

              <div className="team-legend">
                {challengeData
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
            </div>
          ) : (
            <div className="admin-empty">No challenges completed yet.</div>
          )}
        </section>
        
        {/* Security */}
        {isOwnProfile && (
          <section className={`admin-surface mt-6 ${surfaceTone}`}>
            <div className="admin-surface-head">
              <div>
                <div className="admin-surface-title">Security</div>
                <div className="admin-surface-meta">
                  Authentication and account protection
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="admin-mini">
              MFA status: <span className="mono">{mfaEnabled ? "Enabled" : "Disabled"}</span>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {isRecovery ? (
                <button
                  type="button"
                  onClick={() => navigate("/mfa/reset")}
                  className="admin-btn admin-btn-danger"
                >
                  Reset MFA
                </button>
              ) : mfaEnabled ? (
                <Feedback type="success" className="mt-0">
                  Two-factor authentication is active.
                </Feedback>
              ) : (
                <Link to="/mfa/setup" className="admin-btn admin-btn-primary" style={{ width: "auto" }}>
                  Enable Two-Factor Auth
                </Link>
              )}

              {canDeleteAccount && (
                <Link to="/account/delete" className="admin-btn admin-btn-primary" style={{ width: "auto" }}>
                  Delete Account
                </Link>
              )}
            </div>
          </div>

          </section>
        )}
      </div>
    </section>
  );
}

function ProfileBg() {
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
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.10)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.92)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-[#050a07]/55 to-[#050a07]/85" />
      <div className="absolute inset-0 bg-[#050a07]/30" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(110,255,190,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.12) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 3px, transparent 6px)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
