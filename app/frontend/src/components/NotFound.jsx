// NotFound.jsx
import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const fontSize = 16;

    let columns = Math.floor(window.innerWidth / fontSize);
    let drops = Array(columns).fill(1);

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Recalculate columns and reset drops array
      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1);
    };

    resizeCanvas(); // Initial setup

    const draw = () => {
      // Semi-transparent black rectangle to create fading effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0F0"; // green letters
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset drop to top randomly after it goes off screen
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);

    window.addEventListener("resize", resizeCanvas);

    // Cleanup interval and event listener
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="notfound-page">
      {/* Canvas background */}
      <canvas ref={canvasRef} className="notfound-bg" />

      {/* Card with 404 content */}
      <div className="notfound-card">
        <h1 className="notfound-title">404</h1>
        <p className="notfound-subtitle">Oops! The page you are looking for does not exist.</p>
        <p className="notfound-text">
          It might have been removed, renamed, or never existed in the first place.
        </p>
        <Link to="/" className="notfound-btn" aria-label="Go back home">
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
