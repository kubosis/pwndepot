// src/components/LegalPageTemplate.jsx
import React from "react";

export default function LegalPageTemplate({ title, content }) {
  return (
    // Full-bleed section EXACTLY like Register/Home:
    // - w-screen + left-1/2 -translate-x-1/2 breaks out of centered wrappers
    // - min-h-screen ensures the background fills the viewport
    // - -mt-24 + pt-24 matches your navbar offset pattern
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      {/* Background layers (terminal UI vibe, readable) */}
      <div className="absolute inset-0 z-0">
        {/* Base */}
        <div className="absolute inset-0 bg-[#050a07]" />

        {/* Soft emerald tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-[#050a07]/35 to-black/70" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 3px, transparent 6px)",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.45)_70%,rgba(0,0,0,0.80)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.28em] text-emerald-300/60">
            PwnDepot / Legal
          </div>

          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-50">
            {title}
          </h1>

          <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
        </header>

        <article className="legal-prose">{content}</article>
      </div>
    </section>
  );
}
