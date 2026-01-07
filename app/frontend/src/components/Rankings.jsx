// Rankings.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../index.css";

// Helper function to generate a distinct color for each team based on its index
const getDistinctColor = (index, total) =>
  `hsl(${(360 / Math.max(1, total)) * index}, 70%, 50%)`;

export default function Rankings() {
  const canvasRef = useRef(null);
  const chartWrapRef = useRef(null);

  // Data
  const [teams, setTeams] = useState([]);
  const [teamColors, setTeamColors] = useState({});

  // Hover tooltip
  const [hoveredTeam, setHoveredTeam] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // ---------------------------
  // Mock data for frontend testing (kept as-is)
  // ---------------------------
  useEffect(() => {
    // TODO: Replace with backend API call
    const mockTeams = [
      {
        name: "CryptoMasters",
        scores: [
          { time: "10:00", points: 0 },
          { time: "11:00", points: 20 },
          { time: "12:00", points: 50 },
          { time: "13:00", points: 120 },
          { time: "14:00", points: 180 },
          { time: "15:00", points: 228 },
        ],
      },
      {
        name: "WebWizards",
        scores: [
          { time: "10:00", points: 0 },
          { time: "11:00", points: 10 },
          { time: "12:00", points: 30 },
          { time: "13:00", points: 55 },
          { time: "14:00", points: 70 },
          { time: "15:00", points: 91 },
        ],
      },
    ];

    setTeams(mockTeams);

    const colors = {};
    mockTeams.forEach((t, i) => {
      colors[t.name] = getDistinctColor(i, mockTeams.length);
    });
    setTeamColors(colors);
  }, []);

  const getTooltipStyle = () => {
  const canvas = canvasRef.current;
  if (!canvas) return { display: "none" };

  const rect = canvas.getBoundingClientRect();
  const tooltipWidth = 190;
  const tooltipHeight = 56;
  const pad = 10;

  let top = cursorPos.y - tooltipHeight - 10;
  if (top < pad) top = cursorPos.y + 12;

  let left = cursorPos.x + 14;
  if (left + tooltipWidth > rect.width - pad) left = cursorPos.x - tooltipWidth - 14;

  top = Math.max(pad, Math.min(top, rect.height - tooltipHeight - pad));
  left = Math.max(pad, Math.min(left, rect.width - tooltipWidth - pad));

  return { position: "absolute", top, left };
};

  // ---------------------------
  // Sort teams (kept as-is)
  // ---------------------------
  const sortedTeams = useMemo(() => {
    return [...teams]
      .map((t) => {
        const finalScore = t.scores[t.scores.length - 1]?.points || 0;
        const totalPoints = t.scores.reduce((sum, s) => sum + s.points, 0);
        const firstReachedTime =
          t.scores.find((s) => s.points === finalScore)?.time || t.scores[0]?.time || "00:00";
        return { ...t, finalScore, totalPoints, firstReachedTime };
      })
      .sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.firstReachedTime.localeCompare(b.firstReachedTime);
      });
  }, [teams]);

  // ---------------------------
  // Chart data
  // ---------------------------
  const chartTeams = useMemo(
    () => sortedTeams.filter((t) => t.scores.some((s) => s.points > 0)),
    [sortedTeams]
  );

  const topTeams = useMemo(() => chartTeams.slice(0, 5), [chartTeams]);

  // ---------------------------
  // Canvas chart rendering (kept as-is, only styling-neutral)
  // ---------------------------
  useEffect(() => {
    if (!teams.length || !topTeams.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const margin = { top: 40, bottom: 60, left: 70, right: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const yMargin = 20;

    ctx.clearRect(0, 0, width, height);

    const allTimes = Array.from(new Set(topTeams.flatMap((t) => t.scores.map((s) => s.time)))).sort();
    const maxPoints = Math.max(...topTeams.flatMap((t) => t.scores.map((s) => s.points)));
    const yScale = (innerHeight - 2 * yMargin) / (maxPoints * 1.1 || 1);

    // Grid + Y labels
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(235,255,245,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const y = margin.top + yMargin + (innerHeight - 2 * yMargin) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();

      const points = Math.round((maxPoints * 1.1 * (5 - i)) / 5);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(points, margin.left - 12, y);
    }

    // X labels + vertical grid
    ctx.textBaseline = "top";
    allTimes.forEach((time, i) => {
      const x = margin.left + (i / Math.max(1, allTimes.length - 1)) * innerWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + yMargin);
      ctx.lineTo(x, margin.top + innerHeight - yMargin);
      ctx.stroke();

      ctx.textAlign =
        i === 0 ? "left" : i === allTimes.length - 1 ? "right" : "center";
      ctx.fillText(time, x, margin.top + innerHeight - yMargin + 8);
    });

    // Lines + dots
    topTeams.forEach((team) => {
      const color = teamColors[team.name] || "#fff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < team.scores.length - 1; i++) {
        const s1 = team.scores[i];
        const s2 = team.scores[i + 1];

        const x1 =
          margin.left +
          (allTimes.indexOf(s1.time) / Math.max(1, allTimes.length - 1)) * innerWidth;
        const x2 =
          margin.left +
          (allTimes.indexOf(s2.time) / Math.max(1, allTimes.length - 1)) * innerWidth;

        const overlapping1 = topTeams.filter(
          (t2) => t2.scores.find((s) => s.time === s1.time)?.points === s1.points
        );
        const idx1 = overlapping1.findIndex((t2) => t2.name === team.name);

        const overlapping2 = topTeams.filter(
          (t2) => t2.scores.find((s) => s.time === s2.time)?.points === s2.points
        );
        const idx2 = overlapping2.findIndex((t2) => t2.name === team.name);

        const y1 = margin.top + innerHeight - yMargin - s1.points * yScale - idx1 * 6;
        const y2 = margin.top + innerHeight - yMargin - s2.points * yScale - idx2 * 6;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      team.scores.forEach((s) => {
        const x =
          margin.left +
          (allTimes.indexOf(s.time) / Math.max(1, allTimes.length - 1)) * innerWidth;

        const overlapping = topTeams.filter(
          (t2) => t2.scores.find((sc) => sc.time === s.time)?.points === s.points
        );
        const idx = overlapping.findIndex((t2) => t2.name === team.name);
        const y = margin.top + innerHeight - yMargin - s.points * yScale - idx * 6;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
  }, [topTeams, teamColors, teams]);

  // ---------------------------
  // Hover tooltip logic (kept as-is)
  // ---------------------------
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // mouse in CSS pixels (for tooltip positioning)
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    setCursorPos({ x: cssX, y: cssY });

    if (!topTeams.length) return;

    // convert mouse -> canvas coordinate system
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = cssX * scaleX;
    const my = cssY * scaleY;

    const allTimes = Array.from(
      new Set(topTeams.flatMap((t) => t.scores.map((s) => s.time)))
    ).sort();

    const margin = { top: 40, bottom: 60, left: 70, right: 50 };
    const innerWidth = canvas.width - margin.left - margin.right;
    const innerHeight = canvas.height - margin.top - margin.bottom;

    const maxPoints = Math.max(...topTeams.flatMap((t) => t.scores.map((s) => s.points)));
    const yMargin = 20;
    const yScale = (innerHeight - 2 * yMargin) / (maxPoints * 1.1 || 1);

    let closestTeam = null;
    let closestIndex = null;
    let closestDistance = Infinity;

    topTeams.forEach((team) => {
      team.scores.forEach((s, i) => {
        const x =
          margin.left +
          (allTimes.indexOf(s.time) / Math.max(1, allTimes.length - 1)) * innerWidth;

        const overlapping = topTeams.filter(
          (t2) => t2.scores.find((sc) => sc.time === s.time)?.points === s.points
        );
        const idx = overlapping.findIndex((t2) => t2.name === team.name);

        const y =
          margin.top +
          innerHeight -
          yMargin -
          s.points * yScale -
          idx * 6;

        const d = Math.hypot(x - mx, y - my);
        if (d < closestDistance) {
          closestDistance = d;
          closestTeam = team;
          closestIndex = i;
        }
      });
    });

    // threshold in CANVAS pixels (not CSS)
    const HIT_RADIUS = 16; // tweak 12-20
    if (closestDistance <= HIT_RADIUS) {
      setHoveredTeam(closestTeam);
      setHoveredIndex(closestIndex);
    } else {
      setHoveredTeam(null);
      setHoveredIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTeam(null);
    setHoveredIndex(null);
  };

  return (
    // Full-bleed section like Register/Home (prevents background clipping issues)
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      {/* Background layers (1:1 with Home/Register style) */}
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

      {/* Foreground */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <header className="scoreboard-hero">
          <div className="scoreboard-kicker">
            <span className="scoreboard-dot" />
            SECURE://PWN-DEPOT • SCOREBOARD
          </div>

          <div className="scoreboard-headline">
            <h1 className="scoreboard-title">Scoreboard</h1>
            <p className="scoreboard-subtitle">
              Live ranking and progression graph for top teams. Hover points for details.
            </p>
          </div>

          <div className="scoreboard-meta">
            <span className="scoreboard-pill">
              teams: <strong>{sortedTeams.length}</strong>
            </span>
            <span className="scoreboard-pill">
              chart: <strong>top {Math.min(5, chartTeams.length)}</strong>
            </span>
          </div>
        </header>

        {/* Empty state */}
        {teams.length === 0 ? (
          <div className="scoreboard-empty">
            <div className="scoreboard-empty-title">No teams yet</div>
            <div className="scoreboard-empty-subtitle">
              When teams register and submit flags, the chart and ranking will populate here.
            </div>
          </div>
        ) : (
          <>
            {/* Chart */}
            {topTeams.length > 0 && (
              <section className="scoreboard-card">
                <div className="scoreboard-card-head">
                  <div>
                    <div className="scoreboard-card-title">Top teams progression</div>
                    <div className="scoreboard-card-meta">hover points to inspect score</div>
                  </div>
                  <div className="scoreboard-badge">live</div>
                </div>

                <div className="scoreboard-chart-wrap" ref={chartWrapRef}>
                  <canvas
                    ref={canvasRef}
                    width={900}
                    height={400}
                    className="scoreboard-canvas"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  />

                  {/* Tooltip */}
                  {hoveredTeam && hoveredIndex !== null && (
                    <div
                      className="scoreboard-tooltip"
                      style={getTooltipStyle()}
                    >
                      <div className="scoreboard-tooltip-title">
                        <span
                          className="scoreboard-tooltip-swatch"
                          style={{ background: teamColors[hoveredTeam.name] || "#fff" }}
                        />
                        {hoveredTeam.name}
                      </div>
                      <div className="scoreboard-tooltip-body">
                        Score: <strong>{hoveredTeam.scores[hoveredIndex].points}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="scoreboard-legend">
                  {topTeams.map((team) => (
                    <div key={team.name} className="scoreboard-legend-item">
                      <span
                        className="scoreboard-legend-swatch"
                        style={{ backgroundColor: teamColors[team.name] || "#fff" }}
                      />
                      <span className="scoreboard-legend-name">{team.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Table */}
            <section className="scoreboard-card scoreboard-card-table">
              <div className="scoreboard-card-head">
                <div>
                  <div className="scoreboard-card-title">Team ranking</div>
                  <div className="scoreboard-card-meta">
                    Sorted by final score, then total progression, then earliest lead.
                  </div>
                </div>
                <div className="scoreboard-badge">rank</div>
              </div>

              <div className="scoreboard-table-wrap">
                <table className="scoreboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th className="right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => (
                      <tr key={team.name}>
                        <td className="mono">{index + 1}</td>
                        <td>
                          <Link
                            to={`/team/${team.name}`}
                            className="team-link footer-link"
                            style={{ color: teamColors[team.name] || "#fff" }}
                          >
                            {team.name}
                          </Link>
                        </td>
                        <td className="right mono">{team.finalScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}