import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { evaluatePassword, hashPassword } from "../utils/passwordUtils";
import { DEMO_MODE } from "../config/demo";

export default function ChangePassword({ isAdminLoggedIn }) {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ===== Access control =====
  useEffect(() => {
    if (DEMO_MODE) {
      // Demo mode - just read localStorage to allow quick UI testing
      const adminSession = localStorage.getItem("isAdminLoggedIn") === "true";
      if (!isAdminLoggedIn && !adminSession) {
        navigate("/");
      }
    } else {
      // Production mode — verify via backend
      (async () => {
        try {
          const res = await fetch("/api/auth/status", {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (!res.ok) {
            navigate("/");
            return;
          }
          const data = await res.json();
          if (!data.user || data.user.role !== "admin") {
            navigate("/");
          }
        } catch (err) {
          console.error("Session verification failed:", err);
          navigate("/");
        }
      })();
    }
  }, [isAdminLoggedIn, navigate]);

  // ===== Handle input changes =====
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedForm = { ...prev, [name]: value };

      // Check passwords match
      setDoPasswordsMatch(updatedForm.password === updatedForm.confirmPassword);

      // Evaluate strength
      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordMessage(result.message);
        setPasswordStrength(result.strength);
        setIsPasswordValid(result.isValid);
      }

      return updatedForm;
    });
  };

  // ===== Handle password change =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!doPasswordsMatch) return;

    const hashedPassword = await hashPassword(formData.password);

    if (DEMO_MODE) {
      // --- DEMO MODE ONLY ---
      setSuccessMessage(`(Demo Mode) Password for user ${userId} changed successfully!`);
      setTimeout(() => {
        setSuccessMessage("");
        navigate("/admin");
      }, 1500);
      setFormData({ password: "", confirmPassword: "" });
      setPasswordStrength(0);
      setPasswordMessage("");
      setIsPasswordValid(false);
      setDoPasswordsMatch(false);
      return;
    }

    // --- PRODUCTION MODE ---
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: hashedPassword }),
      });

      if (!res.ok) {
        console.error("Failed to change password");
        return;
      }

      setSuccessMessage(`Password for user ${userId} changed successfully!`);

      setTimeout(() => {
        setSuccessMessage("");
        navigate("/admin");
      }, 1500);
    } catch (err) {
      console.error("Error changing password:", err);
    }

    // Reset local form state
    setFormData({ password: "", confirmPassword: "" });
    setPasswordStrength(0);
    setPasswordMessage("");
    setIsPasswordValid(false);
    setDoPasswordsMatch(false);
  };

  // ===== UI helpers =====
  const getStrengthClass = () => {
    if (passwordStrength < 2) return "strength-weak";
    if (passwordStrength === 2 || passwordStrength === 3) return "strength-moderate";
    if (passwordStrength === 4) return "strength-strong";
    return "";
  };

  const isFormValid = isPasswordValid && doPasswordsMatch;

  // ===== Render =====
  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h2>Change Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            name="password"
            placeholder="New Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          <button
            type="submit"
            disabled={!isFormValid}
            className={`register-btn ${isFormValid ? "enabled-animation" : ""}`}
          >
            Change Password
          </button>
        </form>

        {/* Password strength meter */}
        <div className="password-strength">
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
            <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? "valid" : "invalid"}>
              At least 1 special character
            </li>
          </ul>

          {!doPasswordsMatch && formData.confirmPassword.length > 0 && (
            <p className="error-text">Passwords do not match</p>
          )}
        </div>

        {successMessage && <p className="success-text mt-4">{successMessage}</p>}
      </div>
    </div>
  );
}
