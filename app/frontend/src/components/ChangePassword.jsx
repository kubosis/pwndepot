import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { evaluatePassword } from "../utils/passwordUtils";
import { DEMO_MODE } from "../config/demo";
import { API_BASE_URL } from "../config/api";

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
  const [errorMessage, setErrorMessage] = useState("");

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedForm = { ...prev, [name]: value };

      // Check if passwords match
      setDoPasswordsMatch(
        updatedForm.password === updatedForm.confirmPassword
      );

      // Evaluate strength for the main password field
      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordMessage(result.message);
        setPasswordStrength(result.strength);
        setIsPasswordValid(result.isValid);
      }

      return updatedForm;
    });
  };

  // Handle password change
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!doPasswordsMatch) {
      setErrorMessage("Passwords do not match");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage("Password does not meet requirements");
      return;
    }

    if (DEMO_MODE) {
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

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/users/${userId}/password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ new_password: formData.password }),
        }
      );

      if (!res.ok) {
        let msg = "Failed to change password";
        try {
          const data = await res.json();
          if (data && data.detail) msg = data.detail;
        } catch {
          // ignore JSON parse errors, fall back to default message
        }
        setErrorMessage(msg);
        return;
      }

      setSuccessMessage(`Password for user ${userId} changed successfully!`);

      setTimeout(() => {
        setSuccessMessage("");
        navigate("/admin");
      }, 1500);
    } catch (err) {
      console.error("Error changing password:", err);
      setErrorMessage("Network error while changing password");
    }

    // Reset local form state
    setFormData({ password: "", confirmPassword: "" });
    setPasswordStrength(0);
    setPasswordMessage("");
    setIsPasswordValid(false);
    setDoPasswordsMatch(false);
  };

  const getStrengthClass = () => {
    if (passwordStrength < 2) return "strength-weak";
    if (passwordStrength === 2 || passwordStrength === 3) return "strength-moderate";
    if (passwordStrength === 4) return "strength-strong";
    return "";
  };

  const isFormValid = isPasswordValid && doPasswordsMatch;

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

        <div className="password-strength">
          <h3>Password Requirements</h3>
          <div className="strength-bar">
            <div
              className={`strength-bar-fill ${getStrengthClass()}`}
              style={{ width: `${(passwordStrength / 4) * 100}%` }}
            />
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

          {!doPasswordsMatch && formData.confirmPassword.length > 0 && (
            <p className="error-text">Passwords do not match</p>
          )}

          {errorMessage && <p className="error-text mt-2">{errorMessage}</p>}
        </div>

        {successMessage && <p className="success-text mt-4">{successMessage}</p>}
        <button
          type="button"
          className="secondary-btn mt-4"
          onClick={() => navigate("/admin")}
        >
          Back to Admin Panel
        </button>
      </div>
    </div>
  );
}
