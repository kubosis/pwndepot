import React, { useState, useEffect, useCallback } from "react";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";
import MFAInput from "../components/MFAInput";

export default function AdminPage({ loggedInUser, setLoggedInUser}) {
  const initialTime = 7 * 24 * 3600;

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");

  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [ctfRunning, setCtfRunning] = useState(false);
  const [blast, setBlast] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [adminMfaCode, setAdminMfaCode] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [mfaSuccess, setMfaSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminMfaStep, setAdminMfaStep] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);


  const [users, setUsers] = useState([]);
  const minDelay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));



  // -------------------------
  // CTF controls
  // -------------------------
  const startCTF = async () => {
    if (DEMO_MODE) {
      setCtfRunning(true);
      setTimeLeft(initialTime);
      return;
    }

    try {
      await api.post("/challenges/1/ctf-start", {
        duration_seconds: initialTime,
      });

        setCtfRunning(true);
        setTimeLeft(initialTime);

    } catch {
      setErrorMessage("Failed to start CTF");
    }
  };

  const stopCTF = async () => {
    if (DEMO_MODE) {
      setCtfRunning(false);
      setTimeLeft(initialTime);
      return;
    }

    try {
      await api.post("/challenges/1/ctf-stop");

      setCtfRunning(false);
      setTimeLeft(initialTime);
    } catch {
      setErrorMessage("Failed to stop CTF");
    }
  };

  // -------------------------
  // Load users
  // -------------------------
  const loadUsers = useCallback(async () => {
    if (DEMO_MODE) {
      setUsers([
        { id: 1, name: "User1", role: "user", status: "active" },
        { id: 2, name: "User2", role: "user", status: "active" },
        { id: 3, name: "User3", role: "user", status: "suspended" },
        { id: 4, name: "Admin1", role: "admin", status: "active" },
      ]);
      return;
    }

    try {
      const res = await api.get("/users/");
      setUsers(
        res.data.map((u) => ({
          id: u.id,
          name: u.username,
          role: u.role,
          status: u.status,
        }))
      );
    } catch {
      setErrorMessage("Failed to load users");
    }
  }, []);

  useEffect(() => {
    if (loggedInUser?.role === "admin") {
      loadUsers();
    }
  }, [loggedInUser, loadUsers]);

  // -------------------------
  // Admin login
  // -------------------------
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");
    setMfaRequired(false);
    setAdminMfaCode("");

    if (!formData.email || !formData.password) {
      setErrorMessage("Please fill out all fields.");
      setLoading(false);
      return;
    }

    if (DEMO_MODE) {
      setLoggedInUser({ role: "admin", username: "demo_admin" });
      loadUsers();
      setLoading(false);
      return;
    }

    try {
      const body = new URLSearchParams();
      body.append("username", formData.email);
      body.append("password", formData.password);

      const res = await api.post(
        "/users/login?admin=true",
        body,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      await minDelay(1200);

      // MFA REQUIRED
      if (res.data?.mfa_required) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // NO MFA - normal login
      setMfaSuccess("Admin successfully logged in");

      await minDelay(1200);

      const meRes = await api.get("/users/me");
      setLoggedInUser(meRes.data);
      loadUsers();
      setMfaSuccess("");

    } catch (err) {
      await minDelay(1200);
      setMfaRequired(false);
      setAdminMfaCode("");
      setErrorMessage("Invalid credentials or access denied");
      setLoading(false);
    }
  };

  // -------------------------
  // Logout
  // -------------------------
  const handleLogout = async () => {
    try {
      await api.post("/users/logout");
    } finally {
      setUsers([]);
      setLoggedInUser(null);

      // auth
      setFormData({ email: "", password: "" });
      setMfaRequired(false);
      setAdminMfaCode("");
      setMfaSuccess("");
      setErrorMessage("");

      // admin state
      setDeleteTarget(null);
      setStatusTarget(null);
      setAdminPassword("");
      setAdminMfaStep(false);
      setDeleteError("");
      setStatusError("");
      setLoading(false);
      setModalLoading(false);
      document.body.classList.remove("modal-open");
    }
  };

  // -------------------------
  // Timer logic
  // -------------------------
  useEffect(() => {
    if (!ctfRunning) return;
    if (timeLeft <= 0) {
      setCtfRunning(false);
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [ctfRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) {
      setBlast(true);
      const t = setTimeout(() => {
        setBlast(false);
        setTimeLeft(initialTime);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [timeLeft]);

  // -------------------------
  // Modal logic
  // -------------------------
  useEffect(() => {
    if (deleteTarget || statusTarget) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [deleteTarget, statusTarget]);


  // -------------------------
  // Login screen
  // -------------------------
  if (!loggedInUser || loggedInUser.role !== "admin") {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h2>Admin Login</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              placeholder="Admin Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={mfaRequired}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={mfaRequired}
            />

            {!mfaRequired && (
              <button type="submit" disabled={loading}> {loading ? "Logging in ..." : "Login"} </button>
            )}
          </form>
          {/* MFA LOGIN STEP */}
          {!mfaRequired && errorMessage && (
            <p className="error-text">{errorMessage}</p>
          )}
          {mfaRequired && (
            <MFAInput
              value={adminMfaCode}
              onChange={setAdminMfaCode}
              error={errorMessage}
              success={mfaSuccess}
              loading={loading}
              placeholder="Enter MFA code or backup code"
              allowBackup={true}
              showHint={true} 
              onVerify={async () => {
                if (loading) return;

                setLoading(true);
                setErrorMessage("");
                setMfaSuccess("");

                try {
                  await Promise.all([
                    api.post("/mfa/verify", { code: adminMfaCode }),
                    minDelay(1200),
                  ]);

                  setMfaSuccess("MFA verified. Logging in ...");

                  await minDelay(1200);

                  setTimeout(async () => {
                    const meRes = await api.get("/users/me");
                    setLoggedInUser(meRes.data);
                    loadUsers();

                    setMfaRequired(false);
                    setAdminMfaCode("");
                    setLoading(false);
                  }, 1200);
                } catch {
                  await minDelay(1200);
                  setErrorMessage("Invalid MFA code")
                  setAdminMfaCode("");
                  setLoading(false);
                }
              }}
            />
          )}

          <p className="auth-warning">Only authorized admins can log in.</p>
        </div>
      </div>
    );
  }

  // -------------------------
  // Admin dashboard
  // -------------------------
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔥 ADMIN PANEL</h1>
      </div>

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Confirm Deletion</h2>

            <p>
              Are you sure you want to delete {" "}
              <strong>{deleteTarget.name}</strong>?
            </p>

            {/* ADMIN PASSWORD */}
            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={adminMfaStep}
            />

            {/* MFA STEP */}
            {adminMfaStep && (
              <MFAInput
                value={adminMfaCode}
                onChange={setAdminMfaCode}
                error={deleteError}
                success={mfaSuccess}
                loading={modalLoading}
                placeholder="Enter MFA code"
                allowBackup={false}
                showHint={false}
                onVerify={async () => {
                  if (modalLoading) return;
                  setModalLoading(true);
                  setDeleteError("");
                  setMfaSuccess("");

                  // VERIFY MFA
                  try {
                    await api.post("/mfa/admin/verify", { code: adminMfaCode });
                    setAdminMfaCode("");
                    setDeleteError("");
                    setStatusError("");
                  } catch {
                    setDeleteError("Invalid MFA code");
                    setAdminMfaCode("");
                    setModalLoading(false);
                    return;
                  }

                  // EXECUTE DELETE (WITH MFA)
                  try {
                    await api.delete(`/users/${deleteTarget.id}`, {
                      data: { password: adminPassword },
                    });
                    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));

                    setMfaSuccess("MFA Verified. User has been deleted.");

                    setTimeout(() => {
                      // CLEANUP 
                      setDeleteTarget(null);
                      setAdminPassword("");
                      setAdminMfaCode("");
                      setAdminMfaStep(false);
                      setDeleteError("");
                      setMfaSuccess("");
                      setModalLoading(false);
                    }, 1200);
                  } catch {
                    setDeleteError("Delete failed");
                    setModalLoading(false);
                  }
                }}
              />
            )}


            {/* ERROR */}
            {!adminMfaStep && deleteError && (
              <p className="error-text">{deleteError}</p>
            )}
            {!adminMfaStep && mfaSuccess && (
              <p className="success-text">{mfaSuccess}</p>
            )}

            <div className="modal-buttons">
              {!adminMfaStep && (
                <button
                  disabled={modalLoading}
                  className="danger-btn"
                  onClick={async () => {
                    if (modalLoading) return;
                    setModalLoading(true);
                    setDeleteError("");
                    setMfaSuccess("");

                    if (!adminPassword.trim()) {
                      setDeleteError("Admin password is required");
                      setModalLoading(false);
                      return;
                    }

                    try {
                      await api.delete(`/users/${deleteTarget.id}`, {
                        data: { password: adminPassword },
                      });

                      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));

                      setMfaSuccess("User has been deleted successfully.");
                      await minDelay(1200);

                      setDeleteTarget(null);
                      setAdminPassword("");
                      setAdminMfaCode("");
                      setAdminMfaStep(false);
                      setDeleteError("");
                      setMfaSuccess("");
                    } catch (err) {
                      if (err.response?.data?.detail?.code === "MFA_REQUIRED") {
                        setAdminMfaStep(true);
                        setDeleteError("");
                        setMfaSuccess("");
                        setAdminMfaCode("");
                        setModalLoading(false);
                        return;
                      }

                      if (err.response?.status === 403) {
                        setDeleteError("Invalid admin password");
                        setModalLoading(false);
                        return;
                      }

                      setDeleteError("Delete failed");
                    } finally {
                      setModalLoading(false);
                    }
                  }}

                >
                  {modalLoading ? "Processing ..." : "Confirm Delete"}
                </button>
              )}

              <button
                disabled={modalLoading}
                onClick={() => {
                  setDeleteTarget(null);
                  setAdminPassword("");
                  setAdminMfaCode("");
                  setAdminMfaStep(false);
                  setDeleteError("");
                  setMfaSuccess("");
                  setModalLoading(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {statusTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>
              {statusTarget.status === "active"
                ? "Confirm Suspension"
                : "Remove Suspension"}
            </h2>

            <p>
              Are you sure you want to{" "}
              <strong>
                {statusTarget.status === "active" ? "suspend" : "unsuspend"}
              </strong>{" "}
              <strong>{statusTarget.name}</strong>?
            </p>

            {/* ADMIN PASSWORD */}
            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={adminMfaStep || modalLoading}
            />

            {/* MFA STEP */}
            {adminMfaStep && (
              <MFAInput
                value={adminMfaCode}
                onChange={setAdminMfaCode}
                error={statusError}
                success={mfaSuccess}
                loading={modalLoading}
                placeholder="Enter MFA code"
                allowBackup={false}
                showHint={false}
                onVerify={async () => {
                  if (modalLoading) return;
                  setModalLoading(true);
                  setStatusError("");
                  setMfaSuccess("");

                  // VERIFY MFA
                  try {
                    await api.post("/mfa/admin/verify", { code: adminMfaCode });
                    setAdminMfaCode("");
                    setStatusError("");
                    setDeleteError("");
                  } catch {
                    setStatusError("Invalid MFA code");
                    setAdminMfaCode("");
                    setModalLoading(false);
                    return;
                  }
                  
                  const newStatus =
                    statusTarget.status === "active" ? "suspended" : "active";

                  // EXECUTE STATUS CHANGE
                  try {
                    await api.put(`/users/${statusTarget.id}/status`, {
                      status: newStatus,
                      password: adminPassword,
                    });

                    setMfaSuccess(
                      `MFA Verified. ${
                        newStatus === "suspended"
                          ? "User suspended successfully"
                          : "User unsuspended successfully"
                      }`
                    );

                    setTimeout(() => {
                        setUsers(prev =>
                        prev.map(u =>
                          u.id === statusTarget.id
                            ? { ...u, status: newStatus }
                            : u
                        )
                      );

                      // CLEANUP
                      setStatusTarget(null);
                      setAdminPassword("");
                      setAdminMfaCode("");
                      setAdminMfaStep(false);
                      setStatusError("");
                      setMfaSuccess("");
                      setModalLoading(false);
                    }, 1200);
                  } catch {
                    setStatusError("Failed to update status");
                    setModalLoading(false);
                  }
                }}
              />
            )}


            {/* ERROR */}
            {!adminMfaStep && statusError && (
              <p className="error-text">{statusError}</p>
            )}

            {!adminMfaStep && mfaSuccess && (
              <p className="success-text">{mfaSuccess}</p>
            )}

            <div className="modal-buttons">
              {!adminMfaStep && (
                <button
                  disabled={modalLoading}
                  className="danger-btn"
                  onClick={async () => {
                    if (modalLoading) return;
                    setModalLoading(true);
                    setStatusError("");
                    setMfaSuccess("");

                    if (!adminPassword.trim()) {
                      setStatusError("Admin password is required");
                      setModalLoading(false);
                      return;
                    }

                    const newStatus = statusTarget.status === "active" ? "suspended" : "active";

                    try {
                      await api.put(`/users/${statusTarget.id}/status`, {
                        status: newStatus,
                        password: adminPassword,
                      });

                      setUsers((prev) =>
                        prev.map((u) => (u.id === statusTarget.id ? { ...u, status: newStatus } : u))
                      );

                      setMfaSuccess(
                        newStatus === "suspended"
                          ? "User suspended successfully"
                          : "User unsuspended successfully"
                      );

                      await minDelay(1200);

                      setStatusTarget(null);
                      setAdminPassword("");
                      setAdminMfaCode("");
                      setAdminMfaStep(false);
                      setStatusError("");
                      setMfaSuccess("");
                    } catch (err) {
                      if (err.response?.data?.detail?.code === "MFA_REQUIRED") {
                        setAdminMfaStep(true);
                        setStatusError("");
                        setMfaSuccess("");
                        setAdminMfaCode("");
                        setModalLoading(false);
                        return;
                      }

                      if (err.response?.status === 403) {
                        setStatusError("Invalid admin password");
                        setModalLoading(false);
                        return;
                      }

                      setStatusError("Failed to update user status");
                    } finally {
                      setModalLoading(false);
                    }
                  }}
                >
                  {modalLoading ? "Processing ..." : "Confirm"}
                </button>
              )}

              <button
                disabled={modalLoading}
                onClick={() => {
                  setStatusTarget(null);
                  setAdminPassword("");
                  setAdminMfaCode("");
                  setAdminMfaStep(false);
                  setStatusError("");
                  setMfaSuccess("");
                  setModalLoading(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="ctf-controls">
        <button
          className="nuclear-btn"
          onClick={() => (ctfRunning ? stopCTF() : startCTF())}
        >
          {ctfRunning ? "STOP CTF 💀" : "START CTF 💣"}
        </button>

        <button className="logout-btn nuclear-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {blast && <div className="nuclear-blast"></div>}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) => u.role === "user")
              .map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td>
                    <button
                      disabled={modalLoading}
                      onClick={() => {
                        setStatusTarget(user)
                        setAdminPassword("");
                        setAdminMfaCode("");
                        setAdminMfaStep(false);
                        setMfaSuccess("");
                        setStatusError("");
                      }}>
                      {user.status === "active"
                        ? "Suspend"
                        : "Remove Suspension"}
                    </button>

                    <button 
                    disabled={modalLoading}
                    onClick={() => {
                      setDeleteTarget(user);
                      setAdminPassword("");
                      setAdminMfaCode("");
                      setAdminMfaStep(false);
                      setDeleteError("");
                      setMfaSuccess("");
                    }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
