// ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../config/api";
import { evaluatePassword } from "../utils/passwordUtils";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const isResetMode = !!token;

  // ---------------------------
  // STATE
  // ---------------------------
  const [email, setEmail] = useState("");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // 🔹 TOKEN STATUS
  const [tokenStatus, setTokenStatus] = useState(
    isResetMode ? "checking" : "idle"
  );
  // idle | checking | valid | invalid | expired

  const isBusy = loading || tokenStatus === "checking";
  const isFormValid =
    isPasswordValid && doPasswordsMatch && tokenStatus === "valid";

  // ---------------------------
  // VERIFY RESET TOKEN (OPCJA A)
  // ---------------------------
  useEffect(() => {
    if (!token) return;

    setTokenStatus("checking");

    api
      .get("/users/reset-password/verify", {
        params: { token },
      })
      .then(() => {
        setTokenStatus("valid");
      })
      .catch((err) => {
        if (err.response?.status === 410) {
          setTokenStatus("expired");
        } else {
          setTokenStatus("invalid");
        }
      });
  }, [token]);

  // ---------------------------
  // PASSWORD INPUT
  // ---------------------------
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      setDoPasswordsMatch(updated.password === updated.confirmPassword);

      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordStrength(result.strength);
        setPasswordMessage(result.message);
        setIsPasswordValid(result.isValid);
      }

      return updated;
    });
  };

  // ---------------------------
  // REQUEST RESET (EMAIL)
  // ---------------------------
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await api.post("/users/forgot-password", { email });

      setSuccessMessage(
        "If the account exists, a reset link was sent to your email."
      );
    } catch (err) {
      let msg = "Unable to process request.";

      if (err.response?.status === 429) {
        msg = "Too many requests. Please wait before trying again.";
      }

      setErrorMessage(msg);
    } finally {
      // ⏱️ UX delay
      setTimeout(() => setLoading(false), 1200);
    }
  };

  // ---------------------------
  // RESET PASSWORD
  // ---------------------------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await api.post("/users/reset-password", {
        token,
        password: formData.password,
      });

      setSuccessMessage(
        res.data?.message || "Password has been reset successfully."
      );

      // ⏩ redirect to login after success
      setTimeout(() => {
        navigate("/login");
      }, 1200);

    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      let msg = "Unable to reset password.";

      if (status === 400 && detail?.code === "PASSWORD_REUSE") {
        msg = "New password must be different from the old password.";
      } else if (status === 400) {
        msg = "Reset password link is invalid.";
      } else if (status === 410) {
        msg = "Reset password link has expired.";
      } else if (status === 422) {
        msg = detail?.[0]?.msg || "Invalid password.";
      }

      setErrorMessage(msg);
      setLoading(false);
    }
  };

  // ---------------------------
  // PASSWORD STRENGTH STYLE
  // ---------------------------
  const getStrengthClass = () => {
    if (passwordStrength < 2) return "strength-weak";
    if (passwordStrength === 2 || passwordStrength === 3)
      return "strength-moderate";
    if (passwordStrength === 4) return "strength-strong";
    return "";
  };

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Reset Password</h2>

        {/* =========================
            REQUEST MODE (NO TOKEN)
        ========================== */}
        {!isResetMode && (
          <form onSubmit={handleRequestReset}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isBusy}
            />

            <button
              type="submit"
              disabled={isBusy}
              className="register-btn enabled-animation"
            >
              {isBusy ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* =========================
            TOKEN CHECKING
        ========================== */}
        {isResetMode && tokenStatus === "checking" && (
          <p className="text-gray-400 fade-in">
            Verifying reset password link…
          </p>
        )}

        {tokenStatus === "invalid" && (
          <p className="error-text fade-in">
            Reset password link is invalid.
          </p>
        )}

        {tokenStatus === "expired" && (
          <p className="error-text fade-in">
            Reset password link has expired.
          </p>
        )}

        {/* =========================
            RESET FORM (VALID TOKEN)
        ========================== */}
        {tokenStatus === "valid" && (
          <>
            <form onSubmit={handleResetPassword}>
              <input
                type="password"
                name="password"
                placeholder="New Password"
                value={formData.password}
                onChange={handlePasswordChange}
                disabled={isBusy}
                required
              />

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={formData.confirmPassword}
                onChange={handlePasswordChange}
                disabled={isBusy}
                required
              />

              <button
                type="submit"
                disabled={!isFormValid || isBusy}
                className={`register-btn ${
                  isFormValid ? "enabled-animation" : ""
                }`}
              >
                {isBusy ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            {/* PASSWORD REQUIREMENTS */}
            <div className="password-strength mt-2">
              <h3>Password Requirements</h3>

              <div className="strength-bar">
                <div
                  className={`strength-bar-fill ${getStrengthClass()}`}
                  style={{ width: `${(passwordStrength / 4) * 100}%` }}
                ></div>
              </div>

              <p>{passwordMessage}</p>

              <ul className="password-rules">
                <li className={formData.password.length >= 12 ? "valid" : "invalid"}>
                  At least 12 characters
                </li>
                <li className={/[A-Z]/.test(formData.password) ? "valid" : "invalid"}>
                  At least 1 uppercase letter
                </li>
                <li className={/[0-9]/.test(formData.password) ? "valid" : "invalid"}>
                  At least 1 number
                </li>
                <li
                  className={
                    /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
                      ? "valid"
                      : "invalid"
                  }
                >
                  At least 1 special character
                </li>
              </ul>

              {!doPasswordsMatch &&
                formData.confirmPassword.length > 0 && (
                  <p className="error-text">Passwords do not match</p>
                )}
            </div>
          </>
        )}

        {errorMessage && <p className="error-text fade-in">{errorMessage}</p>}
        {successMessage && (
          <p className="success-text fade-in">{successMessage}</p>
        )}

        {!isResetMode && (
          <p className="mt-3">
            <Link to="/login" className="text-blue-400 underline">
              Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
