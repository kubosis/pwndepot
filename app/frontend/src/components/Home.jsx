import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../config/api";

export default function Home({ ctfActive, ctfSecondsLeft }) {
  const [secondsLeft, setSecondsLeft] = useState(
    typeof ctfSecondsLeft === "number" ? ctfSecondsLeft : null
  );
  const [bestTeam, setBestTeam] = useState("TBD");

  useEffect(() => {
    if (typeof ctfSecondsLeft === "number") setSecondsLeft(ctfSecondsLeft);
  }, [ctfSecondsLeft]);

  useEffect(() => {
    if (!ctfActive) return;
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) return;

    const id = setInterval(() => {
      setSecondsLeft((s) => (typeof s === "number" ? Math.max(0, s - 1) : s));
    }, 1000);

    return () => clearInterval(id);
  }, [ctfActive, secondsLeft]);

  useEffect(() => {
    if (!ctfActive) return;
    if (secondsLeft === 0) {
      window.dispatchEvent(new Event("ctf-refresh"));
    }
  }, [ctfActive, secondsLeft]);

    useEffect(() => {
      let alive = true;

      async function loadBestTeam() {
        try {
          const res = await api.get("/challenges/rankings");

          const arr = Array.isArray(res.data) ? res.data : [];
          if (!arr.length) {
            if (alive) setBestTeam("TBD");
            return;
          }

          const top = [...arr].sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0];

          const name = top?.team_name || top?.name || "TBD";

          if (alive) setBestTeam(name !== "TBD" ? `${name}` : "TBD");
        } catch {
          if (alive) setBestTeam("TBD");
        }
      }

      loadBestTeam();

      // refresh once in 15 minutes after ctf starts
      let id = null;
      if (ctfActive) {
        id = setInterval(loadBestTeam, 15000);
      }

      
      const onRefresh = () => loadBestTeam();
      window.addEventListener("ctf-refresh", onRefresh);

      return () => {
        alive = false;
        if (id) clearInterval(id);
        window.removeEventListener("ctf-refresh", onRefresh);
      };
    }, [ctfActive]);


  function formatTime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(" ");
  }
  return (
    // Full-bleed section (forces true viewport width) + must cover at least the viewport
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen pt-24 pb-10">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {/* Background image (covers the entire section area) */}
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

        {/* Right-side fade (keeps wide screens looking filled) */}
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

      {/* Content container */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        {/* Hero area (use min-height so it never clips on smaller screens) */}
        <div className="min-h-[calc(100vh-theme(spacing.24))] flex items-center py-10 sm:py-14">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left copy */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-xs text-emerald-200/80">
                <span className="h-2 w-2 rounded-full bg-emerald-300/90 shadow-[0_0_18px_rgba(110,255,190,0.35)]" />
                SECURE://PWN-DEPOT • SESSION : PUBLIC
              </div>

              {ctfActive ? (
                <>
                  <h1
                    className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight text-emerald-50 leading-[0.98]"
                    style={{
                      textShadow:
                        "0 0 18px rgba(110,255,190,0.14), 0 0 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    WELCOME TO
                    <br />
                    <span className="text-emerald-200">PWNDEPOT.</span>
                  </h1>

                  <div
                    className="mt-4 text-sm sm:text-base text-emerald-50/80 max-w-xl"
                    style={{ textShadow: "0 0 2px rgba(0,0,0,0.75)" }}
                  >
                    Solve challenges, learn, and compete with other teams
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/challenges"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                                 bg-emerald-400 text-[#050a07] border border-emerald-200/30
                                 hover:bg-emerald-300 transition
                                 shadow-[0_10px_30px_rgba(110,255,190,0.18)]
                                 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                    >
                      Begin the challenges
                    </Link>

                    <Link
                      to="/rankings"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                                 bg-black/25 text-emerald-50 border border-emerald-300/30
                                 hover:bg-black/40 hover:border-emerald-200/45 transition
                                 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                    >
                      View scoreboard
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h1
                    className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight text-emerald-50 leading-[0.98]"
                    style={{
                      textShadow:
                        "0 0 18px rgba(110,255,190,0.12), 0 0 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    CTF
                    <br />
                    <span className="text-amber-200">HAS ENDED.</span>
                  </h1>

                  <div className="mt-4 text-sm sm:text-base text-emerald-50/75 max-w-xl">
                    Thanks for playing. Rankings remain available.
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/rankings"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                                 bg-emerald-400 text-[#050a07] border border-emerald-200/30
                                 hover:bg-emerald-300 transition
                                 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                    >
                      View scoreboard
                    </Link>

                    <Link
                      to="/contact"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-md px-6 py-3 text-sm font-semibold
                                 bg-black/25 text-emerald-50 border border-emerald-300/30
                                 hover:bg-black/40 transition"
                    >
                      Contact
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Right visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[4/5] w-full max-w-md ml-auto rounded-2xl overflow-hidden border border-emerald-300/20 bg-black/30 backdrop-blur-sm shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
                <div
                  className="absolute inset-0 opacity-95"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1200&q=80')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="absolute inset-0 bg-emerald-400/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.90)_100%)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Status bar (placeholder) */}
        <div className="relative -mt-8 pb-10">
          <div className="w-full rounded-xl border border-emerald-300/20 bg-emerald-500/15 backdrop-blur-md shadow-[0_15px_50px_rgba(0,0,0,0.6)]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-6 py-4 text-emerald-50">
              <div className="sm:text-left">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                  Time left
                </div>
                <div className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">
                  {ctfActive ? formatTime(secondsLeft) : "0s"}
                </div>
              </div>

              <div className="sm:text-center">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                  CTF status
                </div>
                <div className="mt-1 text-xl font-extrabold tracking-tight">
                  {ctfActive ? "ACTIVE" : "ARCHIVED"}
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
                  Best team
                </div>
                <div className="mt-1 text-xl font-extrabold tracking-tight">{bestTeam}</div>
              </div>
            </div>
          </div>
        </div>

        {/* About section */}
        <div className="py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="text-xs text-emerald-200/70 tracking-widest uppercase">
              About / CTF
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-50">
              PwnDepot is a clean, competitive CTF platform.
            </h2>
            <p className="mt-4 text-emerald-100/70 leading-relaxed">
              Every category unlocks challenges with carefully placed flags. Learn by
              breaking, improve by fixing, and compete on the live scoreboard.
            </p>

            <div className="mt-6">
              <Link
                to="/read-more"
                className="inline-flex items-center gap-2 text-emerald-200 hover:text-emerald-50 transition"
              >
                Read more <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
