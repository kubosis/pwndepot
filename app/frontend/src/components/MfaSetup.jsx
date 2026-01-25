import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../config/api";
import { useNavigate } from "react-router-dom";

function Feedback({ type, children }) {
  if (!children) return null;
  const cls =
    type === "error"
      ? "auth-feedback error"
      : type === "success"
      ? "auth-feedback success"
      : "auth-feedback warn";
  return <div className={cls}>{children}</div>;
}

export default function MfaSetup({ loggedInUser }) {
  const navigate = useNavigate();

  const goBackToProfile = async () => {
    try {
      const username = loggedInUser?.username;
      if (!username) {
        setError("No user in session. Please re-login.");
        return;
      }
      navigate(`/profile/${encodeURIComponent(username)}`);
    } catch (e) {
      console.error(e);
      setError("Could not load your profile.");
    }
  };

  // loading | qr | success | error
  const [step, setStep] = useState("loading");

  const [secretData, setSecretData] = useState(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");

  // Fetch secret on mount
  useEffect(() => {
    const fetchSecret = async () => {
      setStep("loading");
      setError("");
      setWarn("");
      setCopied(false);

      try {
        const res = await api.post("/mfa/setup");
        setSecretData(res.data);
        setStep("qr");
      } catch (err) {
        const detail = err.response?.data?.detail;
        const msg = typeof detail === "string" ? detail : (detail?.message || "Failed to start MFA setup.");
        setError(msg);
        setStep("error");
      }
    };

    fetchSecret();
  }, []);

  const cleanedCode = useMemo(() => code.replace(/\D/g, "").slice(0, 6), [code]);

  const canEnable =
    !!secretData?.secret && cleanedCode.length === 6 && !loading && step === "qr";

  const handleEnable = async () => {
    if (!canEnable) return;

    setLoading(true);
    setError("");
    setWarn("");

    try {
      const res = await api.post("/mfa/enable", {
        secret: secretData.secret,
        code: cleanedCode,
      });

      setBackupCodes(res.data.backup_codes || []);
      setStep("success");

      setWarn("");
    } catch {
      setError("Invalid code. Please verify and try again.");
      setWarn("");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const codes = backupCodes || [];
    const cols = 2;
    const rows = Math.ceil(codes.length / cols);

    const numbered = codes.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c}`);
    const colWidth = Math.max(...numbered.map((s) => s.length), 0) + 6;

    const lines = [];
    for (let r = 0; r < rows; r++) {
      const left = numbered[r] ?? "";
      const right = numbered[r + rows] ?? "";
      lines.push(left.padEnd(colWidth) + right);
    }

    const generatedOn = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());

    const content = [
      "PwnDepot MFA Backup Codes",
      "========================",
      "",
      "Save these codes in a safe place.",
      "Each code can be used only once.",
      "",
      ...lines,
      "",
      "Generated on: " + generatedOn,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "pwndepot-mfa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySecret = async () => {
    if (!secretData?.secret) return;
    try {
      await navigator.clipboard.writeText(secretData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setError("Clipboard blocked. Select the key manually and copy it.");
    }
  };

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-16">
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
            <aside className="auth-side">
              <div className="auth-side-inner">
                <div className="auth-kicker">
                  <span className="auth-dot" />
                  secure://pwn-depot • mfa
                </div>

                <div className="auth-title">
                  Enable
                  <br />
                  <span className="auth-title-accent">two-factor</span> security.
                </div>

                <div className="auth-subtitle">
                  Scan the QR code in your authenticator app, then confirm using a
                  6-digit code. Backup codes are generated once after activation.
                </div>

                <ul className="auth-bullets">
                  <li>Works with Google Authenticator / Authy / 1Password / Aegis.</li>
                  <li>Backup codes are one-time use. Store them securely.</li>
                  <li>Do not share your secret key.</li>
                </ul>

                <div className="auth-chip">
                  <span className="auth-dot auth-dot-soft" />
                  <span>
                    status: <code>{step}</code> • transport: <code>tls</code>
                  </span>
                </div>
              </div>
            </aside>

            <section className="auth-card">
              <div className="auth-card-inner">
                <div className="auth-heading">
                  <h2>MFA Setup</h2>
                  <div className="auth-mini">operator</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="auth-btn auth-btn-ghost"
                    onClick={goBackToProfile}
                  >
                    Back To Profile
                  </button>
                </div>


                <div className="mfa-card-body">
                  {/* Feedback */}
                  <Feedback type="error">{error}</Feedback>

                  {step !== "success" && <Feedback type="warn">{warn}</Feedback>}

                  {copied && <Feedback type="success">Key copied to clipboard.</Feedback>}

                  {step === "loading" && (
                    <Feedback type="warn">Generating secret…</Feedback>
                  )}

                  {step === "error" && !error && (
                    <Feedback type="error">
                      Unable to start MFA setup. Please try again later.
                    </Feedback>
                  )}

                  {step === "qr" && secretData && (
                    <>
                      <Feedback type="success">
                        Step 1: Scan the QR code or enter the key manually
                      </Feedback>

                      <div className="mfa-frame">
                        <div className="mfa-qr-wrap">
                          <div className="mfa-qr-paper" aria-label="MFA QR code">
                            <QRCodeSVG value={secretData.otpauth_url} size={210} />
                          </div>
                        </div>

                        <div className="mfa-divider" />

                        <div className="mfa-form">
                          <div className="mfa-field">
                            <div className="mfa-label">
                              <span>Manual key</span>
                              <span className="mfa-hint">fallback</span>
                            </div>

                            <code className="mfa-secret" title="Select and copy">
                              {secretData.secret}
                            </code>

                            <div style={{ display: "flex", justifyContent: "center" }}>
                              <button
                                type="button"
                                className="auth-btn auth-btn-soft mfa-copy-btn"
                                onClick={copySecret}
                              >
                                copy key
                              </button>
                            </div>
                          </div>

                          <Feedback type="warn">
                            Step 2: Enter a 6-digit code to confirm.
                          </Feedback>

                          <div className="mfa-field">
                            <div className="mfa-label">
                              <span>Verification code</span>
                              <span className="mfa-hint">6 digits</span>
                            </div>

                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="123456"
                              value={cleanedCode}
                              onChange={(e) => {
                                setCode(e.target.value);
                                if (error) setError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleEnable();
                                }
                              }}
                              className="auth-input mono mfa-code"
                            />
                          </div>

                          <button
                            type="button"
                            className="auth-btn auth-btn-primary"
                            disabled={!canEnable}
                            onClick={handleEnable}
                            title={
                              !secretData?.secret
                                ? "Missing secret"
                                : cleanedCode.length !== 6
                                ? "Enter 6 digits"
                                : ""
                            }
                          >
                            {loading ? "Enabling..." : "Enable MFA"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {step === "success" && (
                    <div className="mfa-success">
                      <Feedback type="success">MFA enabled successfully.</Feedback>

                      <Feedback type="warn">
                        Save these backup codes now. They will never be shown again.
                      </Feedback>

                      <div className="mfa-codes-box">
                        <div className="mfa-label" style={{ marginBottom: 10 }}>
                          <span>Backup codes</span>
                          <span className="mfa-hint">one-time use</span>
                        </div>

                        <div className="mfa-codes-actions">
                          <button
                            type="button"
                            className="auth-btn auth-btn-soft"
                            onClick={downloadBackupCodes}
                            disabled={!backupCodes.length}
                          >
                            download (.txt)
                          </button>
                        </div>

                        <div className="mfa-codes-grid mono">
                          {backupCodes.map((c, i) => (
                            <div key={i} className="mfa-code-chip">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="auth-btn auth-btn-primary"
                        onClick={async () => {
                          try {
                            const me = await api.get("/users/me");
                            navigate(`/profile/${me.data.username}`);
                          } catch (e) {
                            console.error(e);
                            setError("Could not load your profile. Please try again.");
                          }
                        }}
                      >
                        I have saved my codes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}