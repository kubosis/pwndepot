// Rankings.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../index.css";

// Helper function to generate a distinct color for each team based on its index
const getDistinctColor = (index, total) => `hsl(${(360 / total) * index}, 70%, 50%)`;

export default function Rankings() {
  const canvasRef = useRef(null);
  const [teams, setTeams] = useState([]); // Stores all team data fetched from backend
  const [hoveredTeam, setHoveredTeam] = useState(null); // Stores team currently hovered on chart
  const [hoveredIndex, setHoveredIndex] = useState(null); // Stores the hovered score index for tooltip
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 }); // Mouse position for tooltip
  const [teamColors, setTeamColors] = useState({}); // Stores a unique color for each team

  // ---------------------------
  // Mock data for frontend testing
  // ---------------------------
  useEffect(() => {
    // TODO: Replace this with actual backend API call
    // Backend API endpoint example: GET /api/teams
    // The backend should return JSON like:
    // [
    //   { "name": "CryptoMasters", "scores": [{"time": "10:00", "points": 0}, ...] },
    //   ...
    // ]
    const mockTeams = [
      { name: "CryptoMasters", scores: [{ time: "10:00", points: 0 }, { time: "11:00", points: 20 }, { time: "12:00", points: 50 }, { time: "13:00", points: 120 }, { time: "14:00", points: 180 }, { time: "15:00", points: 228 }] }, { name: "WebWizards", scores: [{ time: "10:00", points: 0 }, { time: "11:00", points: 10 }, { time: "12:00", points: 30 }, { time: "13:00", points: 55 }, { time: "14:00", points: 70 }, { time: "15:00", points: 91 }] },
      // ... more teams
    ];

    setTeams(mockTeams);

    // Assign each team a unique color for chart visualization
    const colors = {};
    mockTeams.forEach((t, i) => {
      colors[t.name] = getDistinctColor(i, mockTeams.length);
    });
    setTeamColors(colors);
  }, []);

  // ---------------------------
  // Sort teams by their final score, then total points, then first time reaching final score
  // ---------------------------
  const sortedTeams = [...teams]
    .map(t => {
      const finalScore = t.scores[t.scores.length - 1]?.points || 0;
      const totalPoints = t.scores.reduce((sum, s) => sum + s.points, 0);
      const firstReachedTime = t.scores.find(s => s.points === finalScore)?.time || t.scores[0].time;
      return { ...t, finalScore, totalPoints, firstReachedTime };
    })
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.firstReachedTime.localeCompare(b.firstReachedTime);
    });

  // ---------------------------
  // Only include teams with at least one non-zero score in the chart
  // ---------------------------
  const chartTeams = sortedTeams.filter(t => t.scores.some(s => s.points > 0));
  const topTeams = chartTeams.slice(0, 5); // Display top 5 teams in the chart

  // ---------------------------
  // Canvas chart rendering
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

    const allTimes = Array.from(new Set(topTeams.flatMap(t => t.scores.map(s => s.time)))).sort();
    const maxPoints = Math.max(...topTeams.flatMap(t => t.scores.map(s => s.points)));
    const yScale = (innerHeight - 2 * yMargin) / (maxPoints * 1.1 || 1);

    // Draw grid lines and Y-axis labels
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#bbb";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + yMargin + (innerHeight - 2 * yMargin) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
      const points = Math.round(maxPoints * 1.1 * (5 - i) / 5);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(points, margin.left - 12, y);
    }

    // Draw X-axis labels
    ctx.textBaseline = "top";
    allTimes.forEach((time, i) => {
      const x = margin.left + (i / (allTimes.length - 1)) * innerWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + yMargin);
      ctx.lineTo(x, margin.top + innerHeight - yMargin);
      ctx.stroke();
      ctx.textAlign = i === 0 ? "left" : i === allTimes.length - 1 ? "right" : "center";
      ctx.fillText(time, x, margin.top + innerHeight - yMargin + 8);
    });

    // Draw lines and dots for each top team
    topTeams.forEach(team => {
      const color = teamColors[team.name] || "#fff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < team.scores.length - 1; i++) {
        const s1 = team.scores[i];
        const s2 = team.scores[i + 1];
        const x1 = margin.left + (allTimes.indexOf(s1.time) / (allTimes.length - 1)) * innerWidth;
        const x2 = margin.left + (allTimes.indexOf(s2.time) / (allTimes.length - 1)) * innerWidth;

        const overlapping1 = topTeams.filter(t2 => t2.scores.find(s => s.time === s1.time)?.points === s1.points);
        const idx1 = overlapping1.findIndex(t2 => t2.name === team.name);
        const overlapping2 = topTeams.filter(t2 => t2.scores.find(s => s.time === s2.time)?.points === s2.points);
        const idx2 = overlapping2.findIndex(t2 => t2.name === team.name);

        const y1 = margin.top + innerHeight - yMargin - s1.points * yScale - idx1 * 6;
        const y2 = margin.top + innerHeight - yMargin - s2.points * yScale - idx2 * 6;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      team.scores.forEach(s => {
        const x = margin.left + (allTimes.indexOf(s.time) / (allTimes.length - 1)) * innerWidth;
        const overlapping = topTeams.filter(t2 => t2.scores.find(sc => sc.time === s.time)?.points === s.points);
        const idx = overlapping.findIndex(t2 => t2.name === team.name);
        const y = margin.top + innerHeight - yMargin - s.points * yScale - idx * 6;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
  }, [topTeams, teamColors, teams]);

  // ---------------------------
  // Hover tooltip logic
  // ---------------------------
  const handleMouseMove = e => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setCursorPos({ x: clientX, y: clientY });

    if (!topTeams.length) return;

    const allTimes = Array.from(new Set(topTeams.flatMap(t => t.scores.map(s => s.time)))).sort();
    const margin = { top: 40, bottom: 60, left: 70, right: 50 };
    const innerWidth = canvas.width - margin.left - margin.right;
    const innerHeight = canvas.height - margin.top - margin.bottom;
    const maxPoints = Math.max(...topTeams.flatMap(t => t.scores.map(s => s.points)));
    const yMargin = 20;
    const yScale = (innerHeight - 2 * yMargin) / (maxPoints * 1.1 || 1);

    let closestTeam = null;
    let closestIndex = null;
    let closestDistance = Infinity;

    // Find the closest point on the chart to the mouse for tooltip
    topTeams.forEach(team => {
      team.scores.forEach((s, i) => {
        const x = margin.left + (allTimes.indexOf(s.time) / (allTimes.length - 1)) * innerWidth;
        const overlapping = topTeams.filter(t2 => t2.scores.find(sc => sc.time === s.time)?.points === s.points);
        const idx = overlapping.findIndex(t2 => t2.name === team.name);
        const y = margin.top + innerHeight - yMargin - s.points * yScale - idx * 6;
        const distance = Math.hypot(x - clientX, y - clientY);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestTeam = team;
          closestIndex = i;
        }
      });
    });

    setHoveredTeam(closestTeam);
    setHoveredIndex(closestIndex);
  };

  const handleMouseLeave = () => {
    setHoveredTeam(null);
    setHoveredIndex(null);
  };

  // Tooltip style for hovering points
  const getTooltipStyle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { display: "none" };
    const rect = canvas.getBoundingClientRect();
    const tooltipWidth = 170;
    const tooltipHeight = 44;
    let top = cursorPos.y - tooltipHeight - 8;
    if (top < 0) top = cursorPos.y + 8;
    let left = cursorPos.x + 10;
    if (left + tooltipWidth > rect.width) left = cursorPos.x - tooltipWidth - 10;
    if (left < 0) left = 8;
    return {
      position: "absolute",
      top,
      left,
      background: "rgba(36,36,36,0.95)",
      color: "#fff",
      padding: "6px 10px",
      borderRadius: "6px",
      fontSize: "0.85rem",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
    };
  };

  return (
    <div className="scoreboard-page" style={{ paddingBottom: "100px" }}>
      <h2 className="scoreboard-title">🏆 Scoreboard</h2>
      {teams.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: "50px", color: "#ccc" }}>
          No teams have registered yet.
        </p>
      ) : (
        <>
          {/* ---------------------------
              Chart + Legend
              --------------------------- */}
          {topTeams.length > 0 && (
            <div style={{ position: "relative", width: "100%", maxWidth: "900px", margin: "0 auto" }}>
              <canvas
                ref={canvasRef}
                width={900}
                height={400}
                style={{ width: "100%", height: "400px", display: "block" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
              {/* Tooltip for hovered points */}
              {hoveredTeam && hoveredIndex !== null && (
                <div style={getTooltipStyle()}>
                  <strong>{hoveredTeam.name}</strong> | Score: {hoveredTeam.scores[hoveredIndex].points}
                </div>
              )}
              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "1rem",
                  marginTop: "-20px",
                  flexWrap: "wrap",
                }}
              >
                {topTeams.map(team => (
                  <div
                    key={team.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 600,
                      color: teamColors[team.name] || "#fff",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: teamColors[team.name] || "#fff",
                        display: "inline-block",
                        borderRadius: 4,
                      }}
                    />
                    <span>{team.name}</span> 
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------
              Score Table
              --------------------------- */}
          <div
            className="scoreboard-table-container"
            style={{ marginTop: "50px", display: "flex", justifyContent: "center" }}
          >
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team, index) => (
                  <tr key={team.name}>
                    <td>{index + 1}</td>
                    <td>
                      <Link
                        to={`/team/${team.name}`}
                        className="team-link" // Add CSS hover underline effect here
                        style={{ color: teamColors[team.name] || "#fff" }}
                      >
                        {team.name}
                      </Link>
                    </td>
                    <td>{team.finalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}