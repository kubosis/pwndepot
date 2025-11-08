// Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { evaluatePassword, hashPassword } from "../utils/passwordUtils";

// --- Backend security note ---
// Password must meet the following rules before being accepted:
// - At least 12 characters
// - At least 1 uppercase letter
// - At least 1 number
// - At least 1 special character
// Backend should enforce these rules as well, not just frontend.

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // --- Backend validation note ---
  // Backend must also validate:
  // - Username is unique
  // - Email is unique and valid
  // - Role assignment is handled server-side (e.g., default "user")
  // Frontend cannot be trusted to assign or protect roles.

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedForm = { ...prev, [name]: value };

      // Check if passwords match
      setDoPasswordsMatch(updatedForm.password === updatedForm.confirmPassword);

      // Evaluate password strength dynamically
      if (name === "password") {
        const result = evaluatePassword(value);
        setPasswordMessage(result.message);
        setPasswordStrength(result.strength);
        setIsPasswordValid(result.isValid);
      }

      return updatedForm;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setErrorMessage("Password is not strong enough");
      setSuccessMessage("");
      return;
    }

    if (!doPasswordsMatch) {
      setErrorMessage("Passwords do not match");
      setSuccessMessage("");
      return;
    }

    const hashedPassword = await hashPassword(formData.password);

    // --- Frontend-only demo: all new users are assigned role "user"
    const demoUser = {
      username: formData.username,
      email: formData.email,
      password: hashedPassword,
      role: "user", // Frontend demo only – backend must assign this securely
    };

    // --- Backend note ---
    // Backend should handle role assignment securely:
    // 1. Ignore any "role" field sent from frontend.
    // 2. Automatically assign "user" role for all new signups.
    // 3. Only allow admins to promote roles via verified admin endpoints.
    //
    // Example secure backend route:
    // POST /api/register
    // {
    //   "username": "...",
    //   "email": "...",
    //   "password": "hashedPassword"
    // }
    // -> Backend automatically sets role = "user"
    //
    // The backend should:
    // - Validate input fields (email format, username uniqueness)
    // - Hash password using bcrypt or Argon2 before saving
    // - Store { username, email, passwordHash, role: "user" } in the database

    // Example placeholder (uncomment for backend)
    // await fetch("/api/register", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     username: formData.username,
    //     email: formData.email,
    //     password: hashedPassword,
    //   }),
    // });

    setErrorMessage("");
    setSuccessMessage("Registration successful!");

    // Redirect to login after success
    setTimeout(() => {
      navigate("/login");
    }, 1000);
  };

  const getStrengthClass = () => {
    if (passwordStrength < 2) return "strength-weak";
    if (passwordStrength === 2 || passwordStrength === 3) return "strength-moderate";
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

          {/* Submit button enabled only when passwords match and are strong */}
          <button
            type="submit"
            disabled={!isFormValid}
            className={`register-btn ${isFormValid ? "enabled-animation" : ""}`}
          >
            Register
          </button>
        </form>

        {/* Feedback messages */}
        {errorMessage && <p className="fade-in error-text">{errorMessage}</p>}
        {successMessage && <p className="fade-in success-text">{successMessage}</p>}

        {/* Password strength and requirements */}
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

// TODO
// Add option to add MFA(Google Authenticator)
// Verify the email of user