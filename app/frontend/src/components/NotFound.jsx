// src/pages/NotFound.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const location = useLocation();

  const routeLabel = useMemo(() => {
    const p = location?.pathname || "/";
    return p.length > 46 ? `${p.slice(0, 46)}…` : p;
  }, [location?.pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const fontSize = 15;
    const speed = 0.75; 
    const fade = 0.065; 

    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;

    let columns = 0;
    let drops = [];
    let drift = []; 

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.floor(width / fontSize);
      drops = Array(columns).fill(1);
      drift = Array(columns)
        .fill(0)
        .map(() => 0.35 + Math.random() * 1.35); 
    };

    const draw = () => {
      // Fade layer
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
      ctx.fillRect(0, 0, width, height);

      // Glyphs
      ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.fillStyle = "rgba(110,255,190,0.72)"; 

      for (let i = 0; i < drops.length; i++) {
        const ch = letters[(Math.random() * letters.length) | 0];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        const hot = Math.random() > 0.985;
        ctx.fillStyle = hot ? "rgba(235,255,245,0.92)" : "rgba(110,255,190,0.70)";
        ctx.fillText(ch, x, y);

        // update
        drops[i] += speed * drift[i];

        // reset
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="nf-shell">
      {/* background */}
      <canvas ref={canvasRef} className="nf-canvas" aria-hidden="true" />

      <div className="nf-overlay nf-overlay--grad" aria-hidden="true" />
      <div className="nf-overlay nf-overlay--grid" aria-hidden="true" />
      <div className="nf-overlay nf-overlay--vignette" aria-hidden="true" />

      <div className="nf-wrap">
        <header className="nf-kicker">
          <span className="nf-dot" />
          SECURE://PWN-DEPOT • ROUTE NOT FOUND
        </header>

        <div className="nf-card">
          <div className="nf-card-head">
            <div>
              <div className="nf-title">404</div>
              <div className="nf-sub">The requested route does not exist.</div>
            </div>
            <div className="nf-badge">404</div>
          </div>

          <div className="nf-body">
            <div className="nf-line">
              <span className="nf-mini">requested:</span>
              <code className="nf-code">{routeLabel}</code>
            </div>

            <p className="nf-text">
              This address may be invalid, removed, or protected behind navigation you don’t have access to.
            </p>

            <div className="nf-actions">
              <Link to="/rankings" className="team-btn team-btn-ghost">
                Scoreboard
              </Link>
              <Link to="/" className="team-btn">
                Back Home
              </Link>
              <button
                type="button"
                className="team-btn team-btn-ghost"
                onClick={() => window.history.back()}
              >
                Go Back
              </button>
            </div>
          </div>

          <div className="nf-foot">
            <span className="nf-foot-mini">hint: check spelling or use the navigation.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
