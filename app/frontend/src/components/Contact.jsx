// Contact.jsx
import React, { useState, useEffect, useRef } from "react";

export default function Contact() {
  // Form state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    message: "",
  });

  // Feedback state for user messages
  const [feedback, setFeedback] = useState(null);

  // Loading state to disable inputs while submitting
  const [loading, setLoading] = useState(false);

  // Canvas reference for matrix background
  const canvasRef = useRef(null);

  // -----------------------------------
  // MATRIX BACKGROUND EFFECT
  // -----------------------------------
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
      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1);
    };

    resizeCanvas();

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // -----------------------------------
  // AUTO-HIDE FEEDBACK MESSAGES
  // -----------------------------------
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // -----------------------------------
  // HANDLE INPUT CHANGES
  // -----------------------------------
  const handleChange = (e) => {
    if (feedback) setFeedback(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // -----------------------------------
  // HANDLE FORM SUBMISSION
  // -----------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: formData.username.trim(),
      email: formData.email.trim(),
      message: formData.message.trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      setFeedback({ type: "error", text: "All fields are required." });
      return;
    }

    setLoading(true);

    const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

    try {
      if (DEMO_MODE) {
        // ----------------------
        // DEMO MODE (no backend)
        // ----------------------
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setFeedback({
          type: "success",
          text: "Demo mode: message sent successfully!",
        });

        setFormData({ username: "", email: "", message: "" });
        return;
      }

      // ----------------------
      // REAL BACKEND MODE
      // ----------------------
      console.log("API BASE URL =", import.meta.env.VITE_API_BASE_URL);
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!data) {
        throw new Error("Empty response");
      }

      if (!response.ok) {
        throw new Error(data?.detail || "Request failed");
      }

      // UX delay (cosmetic only)
      await new Promise(r => setTimeout(r, 800));

      setFeedback({
        type: data.success ? "success" : "info",
        text: data.message,
      });

      if (data.success) {
        setFormData({ username: "", email: "", message: "" });
      }

    } catch (err) {
      setFeedback({
        type: "error",
        text: "Something went wrong. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="contact-page">
      {/* Matrix canvas background */}
      <canvas ref={canvasRef} className="contact-bg" />

      {/* Contact card */}
      <div className="contact-card">
        <h1 className="contact-title">Contact Us</h1>
        <p className="contact-info">
          If you have any questions about the platform or want to submit your
          own CTF challenge, fill out the form below.
        </p>

        {/* Contact form */}
        <form onSubmit={handleSubmit} className="contact-form">
          <input
            type="text"
            name="username"
            placeholder="Your Username"
            value={formData.username}
            onChange={handleChange}
            disabled={loading} // prevent edits while submitting
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
          />
          <textarea
            name="message"
            placeholder="Your Message"
            rows="5"
            style={{ resize: "none" }} // prevent resizing
            value={formData.message}
            onChange={handleChange}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>

        {/* Feedback message */}
        {feedback && (
          <p
            className={`feedback-message ${feedback.type}`}
            role="alert"
            aria-live="polite"
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}