import { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

function NavLink({ to, children, onClick, variant = "ghost", isActive = false }) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm " +
    "transition focus:outline-none focus:ring-2 focus:ring-emerald-300/40 " +
    "active:translate-y-px";

  const styles =
    variant === "primary"
      ? "bg-emerald-400/10 text-emerald-100 border border-emerald-300/25 shadow-[0_0_0_1px_rgba(110,255,190,0.12)] hover:bg-emerald-400/15"
      : [
          "text-emerald-100/90 hover:text-emerald-50 hover:bg-white/5 border border-transparent",
          isActive
            ? "bg-emerald-400/10 text-emerald-50 border border-emerald-300/20"
            : "",
        ].join(" ");

  return (
    <Link to={to} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

export default function Navbar({
  ctfActive,
  loggedInUser,
  onLogout,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isRecovery = loggedInUser?.token_data?.mfa_recovery === true;

  // Close mobile menu on route change (back / forward / redirects)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const items = useMemo(() => {
    if (!ctfActive) return [];
    if (!loggedInUser) {
      return [
        { to: "/register", label: "Register" },
        { to: "/login", label: "Login" },
        { to: "/teams", label: "Teams" },
        { to: "/rankings", label: "Scoreboard" },
        { to: "/contact", label: "Contact" },
        { to: "/challenges", label: "Challenges" },
      ];
    }
    return [
      { to: "/teams", label: "Teams" },
      { to: "/rankings", label: "Scoreboard" },
      { to: "/contact", label: "Contact" },
      { to: `/profile/${loggedInUser.username}`, label: "My Profile" },
      { to: "/challenges", label: "Challenges"},
    ];
  }, [ctfActive, loggedInUser]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      onLogout?.();
    } finally {
      navigate("/");
      setLoggingOut(false);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#050a07]">
      {/* top glow line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

      <nav
        className="relative border-b border-emerald-300/15 bg-[#050a07] isolate"
        role="navigation"
        aria-label="Main"
      >
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="group flex items-center gap-3 rounded-md px-1 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              >
                <img
                  src={logo}
                  alt="PwnDepot logo"
                  className="h-10 w-10 object-contain transition-transform duration-200 group-hover:scale-[1.06]"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="leading-tight">
                  <div className="text-emerald-50 font-semibold tracking-wide">
                    PwnDepot
                  </div>
                  <div className="text-[11px] text-emerald-200/70">
                    secure node • terminal ui
                  </div>
                </div>
              </Link>

              {isRecovery && (
                <span className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                  <span className="md:hidden">MFA Recovery</span>
                  <span className="hidden md:inline">MFA Recovery Active</span>
                </span>
              )}
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-2">
              {ctfActive &&
                items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    isActive={location.pathname === it.to}
                  >
                    {it.label}
                  </NavLink>
                ))}

              {ctfActive && loggedInUser && (
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="ml-2 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm
                  border border-rose-300/20 bg-rose-400/10 text-rose-100
                hover:bg-rose-400/15 transition
                  focus:outline-none focus:ring-2 focus:ring-rose-300/30
                  cursor-pointer
                  disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              )}
            </div>

            {/* Mobile toggle */}
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-md border border-emerald-300/20 bg-white/5 px-3 py-2 text-emerald-50 hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-emerald-300/10 bg-[#050a07]/95 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col gap-2">
              {ctfActive ? (
                <>
                  {items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      variant="primary"
                      isActive={location.pathname === it.to}
                    >
                      {it.label}
                    </NavLink>
                  ))}

                  {loggedInUser && (
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="mt-1 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm
                                 border border-rose-300/20 bg-rose-400/10 text-rose-100
                                 hover:bg-rose-400/15 transition
                                 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loggingOut ? "Logging out..." : "Logout"}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-sm text-emerald-100/70">
                  CTF inactive.
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
