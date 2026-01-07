import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../config/api";

function Feedback({ message, type }) {
  if (!message) return null;
  return (
    <p className={`${type === "error" ? "error-text" : "success-text"} fade-in`}>
      {message}
    </p>
  );
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setErrorMessage("Invalid or missing verification token.");
      setLoading(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await api.get("/users/verify-email", {
          params: { token },
        });

        setSuccessMessage(
          res.data?.message || "Your email has been verified successfully."
        );

      } catch (err) {
        console.error("Verify email error:", err);

        let msg = "Unable to verify email.";

        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 400) {
          msg = detail?.message || "Invalid verification link.";
        } else if (status === 410) {
          msg = "Verification link has expired. Please request a new one.";
        } else if (status === 404) {
          msg = "User not found.";
        }

        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [navigate, searchParams]);

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Email Verification</h2>

        {loading && (
          <p className="text-gray-400 fade-in">
            Verifying your email…
          </p>
        )}

        {!loading && (
          <>
            <Feedback message={errorMessage} type="error" />
            <Feedback message={successMessage} type="success" />

            <button
              className="enabled-animation mt-4"
              disabled={loading}
              onClick={() => navigate("/login")}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
