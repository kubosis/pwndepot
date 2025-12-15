import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";

export default function AdminPage({ loggedInUser, setLoggedInUser}) {
  const initialTime = 7 * 24 * 3600;

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");

  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [ctfRunning, setCtfRunning] = useState(false);
  const [blast, setBlast] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");


  const [users, setUsers] = useState([]);

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
  const loadUsers = async () => {
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
      const data = res.data;
      setUsers(
        data.map((u) => ({
          id: u.id,
          name: u.username,
          role: u.role,
          status: "active",
        }))
      );
    } catch {
      setErrorMessage("Failed to load users");
    }
  };

  useEffect(() => {
    if (loggedInUser?.role === "admin" && users.length === 0) {
      loadUsers();
    }
  }, [loggedInUser]);

  // -------------------------
  // Admin login
  // -------------------------
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.email || !formData.password) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    if (DEMO_MODE) {
      setLoggedInUser({ role: "admin", username: "demo_admin" });
      loadUsers();
      return;
    }

    try {
      const body = new URLSearchParams();
      body.append("username", formData.email);
      body.append("password", formData.password);

      const res = await api.post(
        "/users/login?admin=true",
        body,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const meRes = await api.get("/users/me");

      const adminUser = meRes.data;
      if (adminUser.role !== "admin") {
        setErrorMessage("Admin privileges required");
        return;
      }

      // THIS updates global auth state
      setLoginSuccess(true);
      // small delay so success message is visible
      setTimeout(() => {
        setLoggedInUser(adminUser);
        loadUsers();
      }, 600);
    } catch {
      setErrorMessage("Network error during login");
    }
  };

  // -------------------------
  // Logout
  // -------------------------
  const handleLogout = async () => {
    try {
      await api.post("/users/logout");
    } catch {}

    setUsers([]);
    setLoginSuccess(false);
    setLoggedInUser(null);
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
    if (deleteTarget) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [deleteTarget]);


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
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit">Login</button>
          </form>
          {errorMessage && <p className="error-text">{errorMessage}</p>}

          {loginSuccess && (
            <p className="success-text">Admin login successful</p>
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
              Are you sure you want to delete user <strong>{deleteTarget.name}</strong>?
            </p>

            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={deleteSuccess}
            />

            {deleteError && (
              <p className="error-text">{deleteError}</p>
            )}

            {deleteSuccess && (
              <p className="success-text">
                User deleted successfully
              </p>
            )}

            <div className="modal-buttons">
              <button
                className="danger-btn"
                disabled={deleteSuccess}
                onClick={async () => {
                  setDeleteError("");

                  try {
                    if (!adminPassword) {
                      setDeleteError("Admin password is required");
                      return;
                    }

                    const res = await api.delete(`/users/${deleteTarget.id}`, {
                      data: { password: adminPassword },
                    });

                    // remove user
                    setUsers((prev) =>
                      prev.filter((u) => u.id !== deleteTarget.id)
                    );

                    // SHOW success
                    setDeleteSuccess(true);

                    // auto-close modal AFTER success is visible
                    setTimeout(() => {
                      setDeleteTarget(null);
                      setAdminPassword("");
                      setDeleteSuccess(false);
                    }, 1500);

                  } catch (err) {
                    if (err.response?.status === 403) {
                      setDeleteError("Invalid admin password");
                    } else {
                      setDeleteError("Delete failed");
                    }
                  }
                }}
              >
                Confirm Delete
              </button>


              <button
                disabled={deleteSuccess}
                onClick={() => {
                  setDeleteTarget(null);
                  setAdminPassword("");
                  setDeleteError("");
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
                      onClick={() =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === user.id
                              ? {
                                  ...u,
                                  status:
                                    u.status === "active"
                                      ? "suspended"
                                      : "active",
                                }
                              : u
                          )
                        )
                      }
                    >
                      {user.status === "active"
                        ? "Suspend"
                        : "Remove Suspension"}
                    </button>

                    <button onClick={() => setDeleteTarget(user)}>
                      Delete
                    </button>

                    <Link to={`/admin/change-password/${user.id}`}>
                      <button>Change Password</button>
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
