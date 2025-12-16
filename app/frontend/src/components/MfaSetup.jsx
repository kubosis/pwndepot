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
      await api.post("/mfa/enable", {
        secret: secretData.secret,
        code: code
      });
      setStep("success");
      setTimeout(() => navigate("/profile/me"), 2000); // Redirect back to profile
    } catch {
      setError("Invalid code. Please verify and try again.");
    }
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

            <p className="text-sm text-gray-300 mt-4 text-center">
              1. Scan this QR code with Google Authenticator.<br/>
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

            <button onClick={handleEnable} disabled={code.length < 6} className="mt-2">
              Enable MFA
            </button>

            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {step === "success" && (
          <div className="text-center">
             <h3 className="text-green-500 font-bold text-xl mb-2">Success!</h3>
             <p>MFA is now enabled on your account.</p>
          </div>
        )}
      </div>
    </div>
  );
}