// Contact.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({ username: "", email: "", message: "" });
  const [feedback, setFeedback] = useState(null); // type: "success" | "error" | "warn"
  const [loading, setLoading] = useState(false);

  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  // -----------------------------------
  // MATRIX BACKGROUND EFFECT (scoped to this section)
  // -----------------------------------
  useEffect(() => {
    const sectionEl = sectionRef.current;
    const canvas = canvasRef.current;
    if (!sectionEl || !canvas) return;

    const ctx = canvas.getContext("2d");
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const fontSize = 16;

    let columns = 0;
    let drops = [];
    let lastTime = 0;
    const FPS = 20;
    const frameInterval = 1000 / FPS;

    const resizeCanvasToSection = () => {
      const rect = sectionEl.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      // canvas backing store (for crisp rendering)
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      // scale so we can draw in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.floor(rect.width / fontSize);
      drops = Array(columns).fill(1);
    };

    // Keep canvas synced with section size (no scrollHeight bugs)
    const ro = new ResizeObserver(() => resizeCanvasToSection());
    ro.observe(sectionEl);
    resizeCanvasToSection();

    const draw = (t) => {
      rafRef.current = requestAnimationFrame(draw);

      if (!lastTime) lastTime = t;
      const delta = t - lastTime;
      if (delta < frameInterval) return;
      lastTime = t - (delta % frameInterval);

      const rect = sectionEl.getBoundingClientRect();

      // fade layer
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = "rgba(110,255,190,0.60)";
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = letters[(Math.random() * letters.length) | 0];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > rect.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  // -----------------------------------
  // AUTO-HIDE FEEDBACK
  // -----------------------------------
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleChange = (e) => {
    if (feedback) setFeedback(null);
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

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
        await new Promise((r) => setTimeout(r, 900));
        setFeedback({ type: "success", text: "Demo mode: message sent successfully!" });
        setFormData({ username: "", email: "", message: "" });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!data) throw new Error("Empty response");
      if (!response.ok) throw new Error(data?.detail || "Request failed");

      await new Promise((r) => setTimeout(r, 650));

      const type = data.success ? "success" : "warn";
      setFeedback({
        type,
        text: data.message || (data.success ? "Message sent." : "Saved, but delivery is pending."),
      });

      if (data.success) setFormData({ username: "", email: "", message: "" });
    } catch {
      setFeedback({ type: "error", text: "Something went wrong. Please try again later." });
    } finally {
      setLoading(false);
    }
  };

  // map warn -> info, because CSS has .contact-feedback.info
  const feedbackClass = useMemo(() => {
    if (feedback?.type === "error") return "contact-feedback error";
    if (feedback?.type === "warn") return "contact-feedback info";
    return "contact-feedback success";
  }, [feedback]);

  return (
    // Full-bleed section 
    <section
      ref={sectionRef}
      className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen -mt-24 pt-24 pb-10"
    >

      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        {/* Background image */}
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />

        {/* Right-side fade */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.12)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.90)_100%)]" />

        {/* Green tint gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/12 via-[#050a07]/50 to-[#050a07]/82" />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#050a07]/30" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Matrix canvas (scoped to this section) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-[0.22] pointer-events-none"
          aria-hidden="true"
        />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 3px, transparent 6px)",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-50">
        <div className="contact-shell">
          <aside className="contact-side">
            <div className="contact-kicker">
              <span className="contact-dot" />
              secure://pwn-depot • support
            </div>

            <div className="contact-title">
              Send a message to
              <br />
              <span>staff</span>.
            </div>

            <div className="contact-subtitle">
              Questions about the platform? Want to submit your own challenge? Send us a message and
              we'll get back to you.
            </div>

            <ul className="contact-bullets">
              <li>No account enumeration (privacy-safe replies).</li>
              <li>Delivery may be deferred if SMTP is unavailable (stored safely).</li>
              <li>Tip: Use a clear subject inside the message body.</li>
            </ul>

            <div className="contact-chip">
              <span className="contact-dot contact-dot-soft" />
              <span>
                status: <code>public</code> • channel: <code>contact</code>
              </span>
            </div>
          </aside>

          <section className="contact-card">
            <div className="contact-card-head">
              <div>
                <div className="contact-card-title">Contact</div>
                <div className="contact-card-meta">{loading ? "sending…" : "ready"}</div>
              </div>
              <div className="contact-badge">{loading ? "busy" : "online"}</div>
            </div>

            <form onSubmit={handleSubmit} autoComplete="on" className="contact-form">
              <div className="contact-field">
                <div className="contact-label">
                  <span>Username</span>
                  <span className="contact-hint">required</span>
                </div>
                <input
                  type="text"
                  name="username"
                  placeholder="e.g. rootkit_neo"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={loading}
                  className="contact-input"
                />
              </div>

              <div className="contact-field">
                <div className="contact-label">
                  <span>Email</span>
                  <span className="contact-hint">required</span>
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder="you@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className="contact-input"
                />
              </div>

              <div className="contact-field">
                <div className="contact-label">
                  <span>Message</span>
                  <span className="contact-hint">required</span>
                </div>
                <textarea
                  name="message"
                  placeholder="Tell us what you need. Include details (challenge name, timestamps, etc.)"
                  value={formData.message}
                  onChange={handleChange}
                  disabled={loading}
                  className="contact-textarea"
                  rows={6}
                />
              </div>

              <button type="submit" disabled={loading} className="contact-submit">
                {loading ? "Sending…" : "Send message"}
              </button>
            </form>

            {feedback && (
              <div className={feedbackClass} role="alert" aria-live="polite">
                {feedback.text}
              </div>
            )}

            <div className="contact-footer">
              <div className="contact-footer-hint auth-bottom" style={{ marginTop: -4 }}>
                Prefer email?{" "}
                <a href="mailto:contact@pwndep0t.com">
                  contact@pwndep0t.com
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
