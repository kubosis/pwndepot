// src/pages/VerifyEmail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../config/api";

function Feedback({ type = "warn", children }) {
  if (!children) return null;

  const cls =
    type === "error"
      ? "admin-feedback error"
      : type === "success"
      ? "admin-feedback success"
      : "admin-feedback warn";

  return <div className={cls}>{children}</div>;
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  const [step, setStep] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setStep("error");
        setMessage("Invalid or missing verification token.");
        setDetail("The verification URL is incomplete. Please request a new link.");
        return;
      }

      try {
        const res = await api.get("/users/verify-email", { params: { token } });

        if (cancelled) return;

        setStep("success");
        setMessage(res.data?.message || "Email verified successfully.");
        setDetail("You can now log in using your credentials.");
      } catch (err) {
        if (cancelled) return;

        const status = err.response?.status;
        const apiDetail = err.response?.data?.detail;

        let msg = "Unable to verify email.";
        let det = "The verification link may be invalid or already used.";

        if (status === 400) {
          msg = apiDetail?.message || "Invalid verification link.";
          det = "Check that you opened the latest link from your mailbox.";
        } else if (status === 410) {
          msg = "Verification link has expired.";
          det = "Request a new verification link and try again.";
        } else if (status === 404) {
          msg = "User not found.";
          det = "The account linked to this token does not exist.";
        }

        setStep("error");
        setMessage(msg);
        setDetail(det);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
      {/* Background layers (green terminal UI ) */}
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.10)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-[#050a07]/55 to-[#050a07]/85" />
        <div className="absolute inset-0 bg-[#050a07]/30" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 3px, transparent 6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="auth-page">
          <div className="auth-shell">
            {/* Left panel */}
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  SECURE://PWN-DEPOT • EMAIL
                </div>

                <div className="auth-title">
                  Verify
                  <br />
                  <span style={{ color: "rgba(110,255,190,0.95)" }}>your email</span>.
                </div>

                <div className="auth-subtitle">
                  This confirms account ownership and enables login. If the link is expired,
                  request a new verification email.
                </div>

                <div className="auth-chip">
                  <span className="auth-dot" />
                  <span>
                    status: <code>{step}</code> • transport: <code>tls</code>
                  </span>
                </div>
              </div>
            </aside>

            {/* Card */}
            <section className="auth-card">
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>Email Verification</h2>
                  <div className="auth-mini">operator</div>
                </div>

                {step === "loading" && (
                  <Feedback type="warn">Verifying your email…</Feedback>
                )}

                {step !== "loading" && (
                  <>
                    {step === "success" ? (
                      <Feedback type="success">{message}</Feedback>
                    ) : (
                      <Feedback type="error">{message}</Feedback>
                    )}

                    {detail && <div className="admin-mini" style={{ marginTop: 8 }}>{detail}</div>}

                    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="auth-btn"
                        onClick={() => navigate("/login")}
                      >
                        Go Back To Login
                      </button>

                      <Link to="/" className="auth-btn">
                        Home
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
