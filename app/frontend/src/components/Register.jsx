// Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { evaluatePassword } from "../utils/passwordUtils";
import { DEMO_MODE } from "../config/demo";
import { api, FRONTEND_MODE } from "../config/api";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ---------------------------
  // HANDLE FORM INPUT
  // ---------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      setDoPasswordsMatch(updated.password === updated.confirmPassword);

      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordMessage(result.message);
        setPasswordStrength(result.strength);
        setIsPasswordValid(result.isValid);
      }

      return updated;
    });
  };

  // ---------------------------
  // SUBMIT REGISTRATION
  // ---------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPasswordValid || !doPasswordsMatch) return;

    // DEMO MODE (no backend)
    if (DEMO_MODE) {
      setSuccessMessage("Demo registration successful");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    try {
      const res = await api.post("/users/register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      setSuccessMessage("Registration successful!");
      setErrorMessage("");

      // PROD mode → COOKIE-based login → redirect normally
      // DEV mode → use token-based login → redirect normally
      setTimeout(() => navigate("/login"), 1200);

    } catch (err) {
      console.error("Registration error:", err);

      let msg = "Registration failed. Please try again.";

      // Backend returns: { detail: "Unable to create account" }
      if (err.response?.data?.detail) msg = err.response.data.detail;

      // Rate limit
      if (err.response?.status === 429) msg = "Too many attempts. Slow down.";

      // Pydantic validation errors
      if (err.response?.status === 422) {
        msg = err.response.data.detail?.[0]?.msg || "Invalid input.";
      }

      setErrorMessage(msg);
      setSuccessMessage("");
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

  const isFormValid = isPasswordValid && doPasswordsMatch;

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Sign Up</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
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
            className={`register-btn ${
              isFormValid ? "enabled-animation" : ""
            }`}
          >
            Register
          </button>
        </form>

        {errorMessage && <p className="fade-in error-text">{errorMessage}</p>}
        {successMessage && (
          <p className="fade-in success-text">{successMessage}</p>
        )}

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

          {!doPasswordsMatch && formData.confirmPassword.length > 0 && (
            <p className="error-text">Passwords do not match</p>
          )}
        </div>

        <p className="mt-3">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
