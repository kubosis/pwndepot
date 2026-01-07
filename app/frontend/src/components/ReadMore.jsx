// src/components/ReadMore.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function ReadMore() {
  return (
    // Full-bleed
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      {/* Background */}
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

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <header className="pt-2 pb-8 sm:pb-10">
          <div className="inline-flex items-center gap-2 text-xs text-emerald-200/80">
            <span className="h-2 w-2 rounded-full bg-emerald-300/90 shadow-[0_0_18px_rgba(110,255,190,0.35)]" />
            SECURE://PWN-DEPOT • DOCS
          </div>

          <h1
            className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-50 leading-[1.02]"
            style={{
              textShadow:
                "0 0 18px rgba(110,255,190,0.12), 0 0 2px rgba(0,0,0,0.6)",
            }}
          >
            Read more about <span className="text-emerald-200">PwnDepot</span>.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-emerald-50/75 max-w-2xl">
            A clean, competitive CTF platform designed for learning-by-doing. Terminal-style UI,
            clear progression, and secure auth flows.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/challenges"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                         bg-emerald-400 text-[#050a07] border border-emerald-200/30
                         hover:bg-emerald-300 transition
                         shadow-[0_10px_30px_rgba(110,255,190,0.18)]
                         focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
            >
              Browse challenges
            </Link>

            <Link
              to="/rankings"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                         bg-black/25 text-emerald-50 border border-emerald-300/30
                         hover:bg-black/40 hover:border-emerald-200/45 transition
                         focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
            >
              View Scoreaboard
            </Link>
          </div>
        </header>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main column */}
          <section className="lg:col-span-8">
            <div className="rounded-2xl border border-emerald-300/20 bg-black/25 backdrop-blur-md shadow-[0_20px_70px_rgba(0,0,0,0.60)] overflow-hidden">
              <div className="px-5 sm:px-6 py-5 border-b border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                  Overview
                </div>
                <div className="mt-2 text-xl font-extrabold text-emerald-50">
                  How the platform is meant to feel
                </div>
                <div className="mt-2 text-sm text-emerald-50/70">
                  Minimal noise, strong contrast, and quick feedback loops.
                </div>
              </div>

              <div className="px-5 sm:px-6 py-5 text-emerald-50/78 text-sm leading-relaxed">
                <p>
                  PwnDepot is built around a simple loop: pick a challenge, investigate, exploit,
                  submit a flag, then see your impact on the scoreboard. The UI intentionally stays
                  "terminal-clean" so players focus on the task, not the page.
                </p>

                <div className="mt-5 rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                    UX principles
                  </div>
                  <ul className="mt-2 grid gap-2 text-emerald-50/75">
                    <li>• Clear state: loading, errors, success, and redirects are explicit.</li>
                    <li>• Safe defaults: forms disable submit until valid and while busy.</li>
                    <li>• Consistent visuals: shared background layers across pages.</li>
                    <li>• Fast readability: mono accents + tabular numbers.</li>
                  </ul>
                </div>

                <div className="mt-5">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                    What you get
                  </div>

                  <div className="mt-3 grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-300/15 bg-black/20 p-4">
                      <div className="font-semibold text-emerald-50">Challenges</div>
                      <div className="mt-1 text-emerald-50/70 text-sm">
                        Categorized tasks with intentional learning curve and flag placement.
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-300/15 bg-black/20 p-4">
                      <div className="font-semibold text-emerald-50">Scoreboard</div>
                      <div className="mt-1 text-emerald-50/70 text-sm">
                        Ranking table + progression chart for top teams with hover details.
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-300/15 bg-black/20 p-4">
                      <div className="font-semibold text-emerald-50">Secure auth</div>
                      <div className="mt-1 text-emerald-50/70 text-sm">
                        Cookie sessions, verification flows, optional MFA.
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-300/15 bg-black/20 p-4">
                      <div className="font-semibold text-emerald-50">Admin controls</div>
                      <div className="mt-1 text-emerald-50/70 text-sm">
                        Red-zone panel with MFA-gated destructive actions.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/register"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                               bg-black/25 text-emerald-50 border border-emerald-300/30
                               hover:bg-black/40 hover:border-emerald-200/45 transition"
                  >
                    Create account
                  </Link>

                  <Link
                    to="/contact"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                               bg-black/25 text-emerald-50 border border-emerald-300/30
                               hover:bg-black/40 hover:border-emerald-200/45 transition"
                  >
                    Contact
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Side column */}
          <aside className="lg:col-span-4">
            <div className="rounded-2xl border border-emerald-300/20 bg-black/25 backdrop-blur-md shadow-[0_20px_70px_rgba(0,0,0,0.60)] overflow-hidden">
              <div className="px-5 sm:px-6 py-5 border-b border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                  Quick links
                </div>
                <div className="mt-2 text-lg font-extrabold text-emerald-50">
                  Operator shortcuts
                </div>
              </div>

              <div className="px-5 sm:px-6 py-5 text-sm">
                <div className="grid gap-3">
                  <Link className="footer-link text-emerald-50/85" to="/challenges">
                    Challenges
                  </Link>
                  <Link className="footer-link text-emerald-50/85" to="/rankings">
                    Scoreboard
                  </Link>
                  <Link className="footer-link text-emerald-50/85" to="/legal-notice">
                    Legal notice
                  </Link>
                  <Link className="footer-link text-emerald-50/85" to="/privacy-policy">
                    Privacy policy
                  </Link>
                </div>

                <div className="mt-6 rounded-xl border border-emerald-300/15 bg-black/20 p-4 text-emerald-50/75">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                    status
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>transport</span>
                    <span className="font-semibold text-emerald-50">tls</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>session</span>
                    <span className="font-semibold text-emerald-50">public</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom */}
        <div className="mt-10 text-center text-emerald-50/60 text-sm">
          <Link to="/" className="footer-link">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
