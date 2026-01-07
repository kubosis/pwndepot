import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react"; // Requires: npm install qrcode.react
import { api } from "../config/api";
import { useNavigate } from "react-router-dom";

export default function MfaSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState("loading"); // loading, qr, success
  const [secretData, setSecretData] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);


  useEffect(() => {
    // Fetch the secret and QR url
    const fetchSecret = async () => {
      try {
        const res = await api.post("/mfa/setup");
        setSecretData(res.data);
        setStep("qr");
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to start MFA setup.");
        setStep("error");
      }
    };
    fetchSecret();
  }, []);

  const handleEnable = async () => {
    try {
      const res = await api.post("/mfa/enable", {
        secret: secretData.secret,
        code: code,
      });

      setBackupCodes(res.data.backup_codes);
      setStep("success");

    } catch {
      setError("Invalid code. Please verify and try again.");
    }
  };

  const downloadBackupCodes = () => {
    const content = [
      "PwnDepot MFA Backup Codes",
      "========================",
      "",
      "Save these codes in a safe place.",
      "Each code can be used only once.",
      "",
      ...backupCodes,
      "",
      "Generated on: " + new Date().toISOString(),
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "pwndepot-mfa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="register-container">
      <div className="register-card profile-card">
        <h2 className="profile-username">Setup MFA</h2>

        {step === "loading" && <p>Generating secret...</p>}

        {step === "error" && <p className="error-text">{error}</p>}

        {step === "qr" && secretData && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-2 rounded">
              <QRCodeSVG value={secretData.otpauth_url} size={180} />
            </div>
            {/* MANUAL SETUP FALLBACK */}
            <div className="mt-3 text-sm text-gray-300 text-center">
              <p className="mb-1">Can’t scan the QR code?</p>
              <p className="text-xs text-gray-400">
                Enter this key manually in your authenticator app:
              </p>

              <code
                className="mt-2 block bg-gray-900 px-3 py-2 rounded tracking-widest text-white select-all"
                title="Click to select"
              >
                {secretData.secret}
              </code>
            </div>

            <p className="text-sm text-gray-300 mt-4 text-center">
              1. Scan this QR code <b>or enter the key manually</b> in Google Authenticator.<br/>
              2. Enter the 6-digit code below to confirm.
            </p>

            <input
              type="text"
              placeholder="123456"
              value={code}
              maxLength="6"
              onChange={(e) => setCode(e.target.value)}
              className="mt-4 text-center tracking-widest"
            />

            <button onClick={handleEnable} disabled={code.length < 6 || step === "success"} className="mt-2">
              Enable MFA
            </button>

            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {step === "success" && (
          <div className="text-center fade-in">
            <h3 className="success-text mb-2">MFA Enabled</h3>

            <p className="text-yellow-400 mb-3">
              Save these backup codes now. They will never be shown again.
            </p>

            <div className="bg-black rounded p-3 text-left">
              <button
                className="mt-3 fancy-btn"
                onClick={downloadBackupCodes}
              >
                Download backup codes (.txt)
              </button>
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="font-mono tracking-widest text-sm text-white"
                >
                  {code}
                </div>
              ))}
            </div>

            <button
              className="mt-4 fancy-btn"
              onClick={async () => {
                const me = await api.get("/users/me");
                navigate(`/profile/${me.data.username}`);
              }}
            >
              I have saved my codes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}