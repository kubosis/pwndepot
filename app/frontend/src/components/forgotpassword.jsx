// forgotpassword.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Forgot Password</h2>

        <p style={{ textAlign: "center", marginBottom: "1.5rem", color: "#bbb" }}>
          If you forgot your password, please contact the admin of this page
          for assistance.
        </p>

        <Link to="/login">
          <button className="enabled-animation">Back to Login</button>
        </Link>
      </div>
    </div>
  );
}