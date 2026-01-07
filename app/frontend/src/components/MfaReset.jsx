import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../config/api";

export default function MfaReset({ setLoggedInUser }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); 
  // loading | success | error

  useEffect(() => {
    const reset = async () => {
      try {
        await api.post("/mfa/reset");
        setStatus("success");

        // UX delay
        setTimeout(() => {
          setLoggedInUser(null);
          navigate("/login");
        }, 2000);

      } catch {
        setStatus("error");
      }
    };

    reset();
  }, []);

  return (
    <div className="register-container">
      <div className="register-card text-center">
        {status === "loading" && <p>Resetting MFA…</p>}

        {status === "success" && (
          <>
            <h2 className="success-text">MFA reset successful</h2>
            <p className="text-gray-400 mt-2">
              You have been logged out. Please log in and set up MFA again.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h2 className="error-text">MFA reset failed</h2>
            <p className="text-gray-400 mt-2">
              This action is only allowed during a recovery session.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
