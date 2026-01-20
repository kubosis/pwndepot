// Rankings.jsx
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../index.css";
import { api } from "../config/api";

// Helper: distinct color for each team
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
  // Date helpers
  // ---------------------------
  function toTs(dateStr) {
    const d = new Date(dateStr);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // Label with full local date-time (not used on axis directly)
  function toDateTimeLabel(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "1970-01-01 00:00";
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  // Axis label: MM-DD HH:mm (important: same time on different days is unique)
  function toAxisLabel(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${mi}`;
  }

  // ---------------------------
  // Build cumulative scores
  // ---------------------------
  function buildCumulativeScores(scoreRecords) {
    const sorted = [...(scoreRecords || [])].sort(
      (a, b) => toTs(a.date_time) - toTs(b.date_time)
    );

    let acc = 0;

    // Start point: 1 second before first solve (or now if empty)
    const firstTs = sorted.length ? toTs(sorted[0].date_time) : Date.now();
    const startTs = firstTs - 1000;

    const out = [
      {
        ts: startTs,
        label: toDateTimeLabel(new Date(startTs).toISOString()),
        points: 0,
        isStart: true,
      },
    ];

    for (const r of sorted) {
      const delta = Number(r.score || 0);
      acc += delta;
      out.push({
        ts: toTs(r.date_time),
        label: toDateTimeLabel(r.date_time),
        points: acc,
        isStart: false,
      });
    }

    return out;
  }

  // ---------------------------
  // Fetch teams
  // ---------------------------
  useEffect(() => {
    let mounted = true;

    async function loadTeams() {
      try {
        const res = await api.get("/teams");
        const rows = Array.isArray(res.data) ? res.data : [];

        const mapped = rows.map((t) => ({
          id: t.team_id,
          name: t.team_name,
          scores: buildCumulativeScores(t.scores),
          total_score: Number(t.total_score || 0),
        }));

        if (!mounted) return;

        setTeams(mapped);

        const colors = {};
        mapped.forEach((t, i) => {
          colors[t.name] = getDistinctColor(i, mapped.length);
        });
        setTeamColors(colors);
      } catch {
        if (!mounted) return;
        setTeams([]);
        setTeamColors({});
      }
    }

    loadTeams();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------
  // Tooltip positioning (CSS pixels)
  // ---------------------------
  const getTooltipStyle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { display: "none" };

    const rect = canvas.getBoundingClientRect();
    const tooltipWidth = 210;
    const tooltipHeight = 60;
    const pad = 10;

    let top = cursorPos.y - tooltipHeight - 10;
    if (top < pad) top = cursorPos.y + 12;

    let left = cursorPos.x + 14;
    if (left + tooltipWidth > rect.width - pad)
      left = cursorPos.x - tooltipWidth - 14;

    top = Math.max(pad, Math.min(top, rect.height - tooltipHeight - pad));
    left = Math.max(pad, Math.min(left, rect.width - tooltipWidth - pad));

    return { position: "absolute", top, left };
  };

  // ---------------------------
  // Sort teams 
  // ---------------------------
  const sortedTeams = useMemo(() => {
    return [...teams]
      .map((t) => {
        const finalScore = t.scores[t.scores.length - 1]?.points || 0;
        const totalPoints = finalScore;

        // earliest timestamp when it reached finalScore
        const firstReachedTs =
          t.scores.find((s) => s.points === finalScore)?.ts ??
          t.scores[0]?.ts ??
          0;

        return { ...t, finalScore, totalPoints, firstReachedTs };
      })
      .sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.firstReachedTs - b.firstReachedTs;
      });
  }, [teams]);

  // Only teams that have >0 at least once
  // Teams eligible for chart: must have >0 points at least once
  const chartTeams = useMemo(() => {
    return sortedTeams.filter((t) =>
      Array.isArray(t.scores) && t.scores.some((s) => (s?.points ?? 0) > 0)
    );
  }, [sortedTeams]);

  // We draw at most TOP 5 teams
  const topTeams = useMemo(() => chartTeams.slice(0, 5), [chartTeams]);

  // ---------------------------
  // Time binning (for large number of points)
  // Prevents "1000 points on 900px canvas" overlaps.
  //
  // Idea: bucket by time resolution, keep LAST score per bucket (still cumulative).
  // ---------------------------
  function binScores(scores, bucketMs) {
    if (!Array.isArray(scores) || scores.length === 0) return [];
    if (!bucketMs || bucketMs <= 0) return scores;

    const out = [];
    let lastBucket = null;

    for (const s of scores) {
      const bucket = Math.floor(s.ts / bucketMs);
      if (bucket !== lastBucket) {
        out.push({ ...s });
        lastBucket = bucket;
      } else {
        // same bucket -> overwrite with the latest (keeps cumulative correct)
        out[out.length - 1] = { ...s };
      }
    }
    return out;
  }

  // Pick bucket size dynamically based on how many timestamps we have on canvas width.
  // We target roughly <= 220 points across allTs (for readability).
  function chooseBucketMs(allTs) {
    if (!allTs.length) return 0;

    // If <= 240 unique timestamps, no need to bin
    if (allTs.length <= 240) return 0;

    // Otherwise bin to 1min / 5min / 15min / 1h
    // (progressively stronger binning)
    const ONE_MIN = 60_000;
    const FIVE_MIN = 5 * ONE_MIN;
    const FIFTEEN_MIN = 15 * ONE_MIN;
    const ONE_HOUR = 60 * ONE_MIN;

    if (allTs.length <= 600) return ONE_MIN;
    if (allTs.length <= 1500) return FIVE_MIN;
    if (allTs.length <= 4000) return FIFTEEN_MIN;
    return ONE_HOUR;
  }

  // ---------------------------
  // Geometry helper used by BOTH render and hover.
  // This guarantees hover hits exactly what you draw.
  // ---------------------------
  function computePointGeometry({
    canvas,
    topTeamsInput,
    teamColorsInput,
  }) {
    const width = canvas.width;
    const height = canvas.height;
    const margin = { top: 50, bottom: 130, left: 110, right: 70 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const yMargin = 20;

    // 1) Gather ALL timestamps (raw)
    const rawAllTs = Array.from(
      new Set(topTeamsInput.flatMap((t) => t.scores.map((s) => s.ts)))
    )
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);

    // 2) Determine bin size and bin each team's scores
    const bucketMs = chooseBucketMs(rawAllTs);

    const binnedTeams = topTeamsInput.map((t) => ({
      ...t,
      // Bin scores to reduce total timestamps and points
      scores: binScores(t.scores, bucketMs),
    }));

    // Recompute timestamps AFTER binning
    const allTs = Array.from(
      new Set(binnedTeams.flatMap((t) => t.scores.map((s) => s.ts)))
    )
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);

    // X position mapping (index-based)
    const xPos = new Map();
    allTs.forEach((ts, i) => {
      const x = margin.left + (i / Math.max(1, allTs.length - 1)) * innerWidth;
      xPos.set(ts, x);
    });

    // Max points (for scaling)
    const maxPoints = Math.max(
      1,
      ...binnedTeams.flatMap((t) => t.scores.map((s) => s.points))
    );
    const yScale = (innerHeight - 2 * yMargin) / (maxPoints * 1.1 || 1);

    // Jitter settings:
    // - X jitter spreads points that share same (ts, points)
    // - Y jitter spreads points that share same (ts, points) symmetrically
    const X_JITTER_MAX = 10;
    const Y_JITTER_STEP = 6;

    function jitterStep(count) {
      // Keep step small and bounded; grows automatically with crowding.
      // More overlapping points => more spread, but still capped.
      // We want jitter <= X_JITTER_MAX
      if (count <= 1) return 0;
      const step = Math.floor((2 * X_JITTER_MAX) / (count - 1));
      return Math.max(1, Math.min(4, step));
    }

    // Precompute per timestamp+score overlap groups for speed
    // Key: `${ts}|${points}` => array of teamNames sorted by draw order
    const overlapMap = new Map();
    for (const t of binnedTeams) {
      for (const s of t.scores) {
        const key = `${s.ts}|${s.points}`;
        if (!overlapMap.has(key)) overlapMap.set(key, []);
        overlapMap.get(key).push(t.name);
      }
    }

    // For stable jitter assignment, sort names in the same order as binnedTeams
    for (const [key, arr] of overlapMap.entries()) {
      const order = new Map(binnedTeams.map((t, idx) => [t.name, idx]));
      arr.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      overlapMap.set(key, arr);
    }

    // Return a function that converts (teamName, scoreObj) -> {x,y}
    function pointXY(teamName, s) {
      const baseX = xPos.get(s.ts);
      if (baseX == null) return null;

      const key = `${s.ts}|${s.points}`;
      const group = overlapMap.get(key) || [];
      const idx = group.indexOf(teamName);
      const count = group.length;

      // Centered jitter index: e.g. count=5 => idx - 2
      const centered = idx - (count - 1) / 2;

      const xStep = jitterStep(count);
      const x = baseX + centered * xStep;

      const yJ = centered * Y_JITTER_STEP;
      const y =
        margin.top + innerHeight - yMargin - s.points * yScale - yJ;

      return { x, y, idx, count };
    }

    return {
      margin,
      innerWidth,
      innerHeight,
      yMargin,
      yScale,
      maxPoints,
      xPos,
      allTs,
      bucketMs,
      binnedTeams,
      pointXY,
    };
  }

  // ---------------------------
  // Canvas chart rendering
  // ---------------------------
  useEffect(() => {
    if (!teams.length || !topTeams.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const geom = computePointGeometry({
      canvas,
      topTeamsInput: topTeams,
      teamColorsInput: teamColors,
    });

    const {
      margin,
      innerWidth,
      innerHeight,
      yMargin,
      allTs,
      maxPoints,
      binnedTeams,
      pointXY,
    } = geom;

    // ---------- Grid + Y labels ----------
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

    // ---------- X labels (SUPER CLEAN: zero overlap, last always visible) ----------
    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(235,255,245,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;

    const rotate = allTs.length > 18;
    const angle = rotate ? -Math.PI / 6 : 0;

    // HARD GAP in CANVAS px
    const minGapPx = rotate ? 130 : 110;

    function drawTick(x, label, { align = "center", drawGrid = true } = {}) {
      if (drawGrid) {
        ctx.beginPath();
        ctx.moveTo(x, margin.top + yMargin);
        ctx.lineTo(x, margin.top + innerHeight - yMargin);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(x, margin.top + innerHeight - yMargin + 8);
      if (rotate) ctx.rotate(angle);

      ctx.textAlign = align;
      ctx.textBaseline = "top";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    if (allTs.length > 0) {
      const firstTs = allTs[0];
      const lastTs = allTs[allTs.length - 1];

      const xFirst = geom.xPos.get(firstTs);
      const xLast = geom.xPos.get(lastTs);

      // 1) Always draw first + last
      drawTick(xFirst, "start", { align: rotate ? "left" : "left" });
      drawTick(xLast, toAxisLabel(lastTs), { align: rotate ? "right" : "right" });

      // 2) Draw middle ticks with strict spacing, AND reserve space for last
      let lastDrawnX = xFirst;

      // Do not draw any middle label within `minGapPx` of the last label
      const stopBeforeX = xLast - minGapPx;

      for (let i = 1; i < allTs.length - 1; i++) {
        const ts = allTs[i];
        const x = geom.xPos.get(ts);
        if (x == null) continue;

        // reserve space for last label
        if (x > stopBeforeX) break;

        // strict spacing
        if (x - lastDrawnX < minGapPx) continue;

        drawTick(x, toAxisLabel(ts), { align: rotate ? "right" : "center" });
        lastDrawnX = x;
      }
    }

    ctx.restore();

    // ---------- Lines + dots ----------
    for (const team of binnedTeams) {
      const color = teamColors[team.name] || "#fff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Lines
      for (let i = 0; i < team.scores.length - 1; i++) {
        const s1 = team.scores[i];
        const s2 = team.scores[i + 1];

        const p1 = pointXY(team.name, s1);
        const p2 = pointXY(team.name, s2);
        if (!p1 || !p2) continue;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Dots
      for (const s of team.scores) {
        const p = pointXY(team.name, s);
        if (!p) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }, [topTeams, teamColors, teams]);

  // ---------------------------
  // Hover logic: uses same geometry as draw
  // ---------------------------
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Cursor in CSS pixels (tooltip positioning)
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    setCursorPos({ x: cssX, y: cssY });

    if (!topTeams.length) return;

    // Convert mouse -> canvas coordinate system
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = cssX * scaleX;
    const my = cssY * scaleY;

    const geom = computePointGeometry({
      canvas,
      topTeamsInput: topTeams,
      teamColorsInput: teamColors,
    });

    let closestTeam = null;
    let closestIndex = null;
    let closestDistance = Infinity;

    // NOTE: we hover over Binned teams (since we draw binned)
    for (const team of geom.binnedTeams) {
      for (let i = 0; i < team.scores.length; i++) {
        const s = team.scores[i];
        const p = geom.pointXY(team.name, s);
        if (!p) continue;

        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < closestDistance) {
          closestDistance = d;
          closestTeam = team;
          closestIndex = i;
        }
      }
    }

    const HIT_RADIUS = 16; // in canvas pixels
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
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      {/* Background layers */}
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
              chart:{" "}
              <strong>
                {chartTeams.length === 0 ? "hidden" : `top ${Math.min(5, chartTeams.length)}`}
              </strong>
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
            {/* If teams exist but nobody scored yet */}
            {teams.length > 0 && chartTeams.length === 0 && (
              <div className="scoreboard-empty">
                <div className="scoreboard-empty-title">No scores yet</div>
                <div className="scoreboard-empty-subtitle">
                  Teams exist, but nobody has scored points yet. The chart will appear after the first solve.
                </div>
              </div>
            )}
            {/* Chart */}
            {chartTeams.length > 0 && topTeams.length > 0 && (
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
                  {hoveredTeam && hoveredIndex !== null && hoveredTeam.scores?.[hoveredIndex] && (
                    <div className="scoreboard-tooltip" style={getTooltipStyle()}>
                      <div className="scoreboard-tooltip-title">
                        <span
                          className="scoreboard-tooltip-swatch"
                          style={{ background: teamColors[hoveredTeam.name] || "#fff" }}
                        />
                        {hoveredTeam.name}
                      </div>
                      <div className="scoreboard-tooltip-body">
                        Time:{" "}
                        <strong>
                          {hoveredTeam.scores[hoveredIndex].isStart
                            ? "start"
                            : hoveredTeam.scores[hoveredIndex].label}
                        </strong>
                        <br />
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
