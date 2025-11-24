import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";
import { API_BASE_URL } from "../config/api";

export default function AdminPage({ setIsAdminLoggedIn, authToken, setAuthToken }) {
  const initialTime = 7 * 24 * 3600; // 7 days in seconds

  // Admin login states
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [isAdminLogged, setIsAdminLogged] = useState(false);

  // CTF timer states
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [ctfRunning, setCtfRunning] = useState(false);
  const [blast, setBlast] = useState(false);

  // Users list (demo data)
  const [users, setUsers] = useState([
    { id: 1, name: "User1", role: "user", status: "active" },
    { id: 2, name: "User2", role: "user", status: "active" },
    { id: 3, name: "User3", role: "user", status: "suspended" },
    { id: 4, name: "Admin1", role: "admin", status: "active" },
  ]);

  // ====== FETCH THE USERS FROM THE BACKEND (only in prod mode) ======
  const loadUsers = async (token) => {
    if (DEMO_MODE) return; // in demo we still use local users

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to load users");
        return;
      }

      const data = await res.json();
      const mapped = data.map((u) => ({
        id: u.id,
        name: u.username || u.email || `user-${u.id}`,
        role: u.role || "user",
        status: u.is_active === false ? "suspended" : "active",
      }));
      setUsers(mapped);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  // Handle form change
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Handle admin login
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    // DEMO MODE
    if (DEMO_MODE) {
      if (
        formData.email === "admin@example.com" &&
        formData.password === "admin123"
      ) {
        setIsAdminLogged(true);
        setIsAdminLoggedIn(true);
        localStorage.setItem("isAdminLoggedIn", "true");
        setErrorMessage("");
      } else {
        setErrorMessage("Invalid admin credentials!");
      }
      return;
    }

    // ===== PRODUCTION MODE (backend) =====
    try {
      // we don't hash the password here, backend has it's own hashing logic
      const body = new URLSearchParams();
      body.append("username", formData.email); // backend treats "username" as email
      body.append("password", formData.password);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/users/login?admin=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.detail || "Invalid admin credentials!");
        return;
      }

      const token = data.access_token;
      setAuthToken(token);
      setIsAdminLogged(true);
      setIsAdminLoggedIn(true);
      setErrorMessage("");

      // After a succesful login load the users
      await loadUsers(token);
    } catch (err) {
      console.error("Login failed:", err);
      setErrorMessage("Network error during login.");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (DEMO_MODE) {
      localStorage.removeItem("isAdminLoggedIn");
    } else if (authToken) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/users/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch (err) {
        console.warn("Logout request failed (possibly offline):", err);
      }
    }

    setAuthToken(null);
    setIsAdminLogged(false);
    setIsAdminLoggedIn(false);
  };

  // Auto-login from localStorage (for demo only)
  useEffect(() => {
    if (DEMO_MODE && localStorage.getItem("isAdminLoggedIn") === "true") {
      setIsAdminLogged(true);
      setIsAdminLoggedIn(true);
    }
  }, [setIsAdminLoggedIn]);

  // CTF timer logic
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
      const blastTimeout = setTimeout(() => {
        setBlast(false);
        setTimeLeft(initialTime);
      }, 1500);
      return () => clearTimeout(blastTimeout);
    }
  }, [timeLeft]);

  // Helper functions for CTF clock
  const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const secDeg = -(seconds * 6);
  const minDeg = -(minutes * 6 + seconds * 0.1);
  const hourDeg = -((hours % 12) * 30 + minutes * 0.5);

  const formatDigital = (seconds) => {
    const d = Math.floor(seconds / (24 * 3600));
    const h = Math.floor((seconds % (24 * 3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d}d ${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Suspend / Remove / Delete user handlers - backend still doesn't have this logic
  const suspendUser = (id) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "suspended" } : u)));
  const removeSuspension = (id) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "active" } : u)));
  // DELETE user - backend integration
  const deleteUser = async (id) => {
    if (DEMO_MODE) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return;
    }

    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to delete user");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Delete user error:", err);
    }
  };

  // Admin Login Screen
  if (!isAdminLogged) {
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
          <p className="auth-warning">Only authorized admins can log in.</p>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔥 ADMIN PANEL</h1>
      </div>

      {/* CTF Timer controls */}
      <div className="ctf-controls">
        <button
          className="nuclear-btn"
          onClick={() => {
            setCtfRunning(!ctfRunning);

            // --- Backend note ---
            // When starting/stopping CTF, send an API call to backend:
            // POST /api/ctf-start -> sets ctfActive = true, starts timer
            // POST /api/ctf-stop  -> sets ctfActive = false, stops timer
          }}
        >
          {ctfRunning ? "STOP CTF 💀" : "START CTF 💣"}
        </button>
        <button className="logout-btn nuclear-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {(timeLeft > 0 || blast) && (
        <div className="ctf-clock">
          <div className="manual-clock">
            <div className="hand hour" style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }} />
            <div className="hand minute" style={{ transform: `translate(-50%, -100%) rotate(${minDeg}deg)` }} />
            <div className="hand second" style={{ transform: `translate(-50%, -100%) rotate(${secDeg}deg)` }} />
            <div className="center-dot" />
          </div>
          <div className="digital-clock">
            The CTF will end in: {formatDigital(timeLeft)}
          </div>
        </div>
      )}
      {blast && <div className="nuclear-blast"></div>}

      {/* Users Table */}
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
                    {user.status === "active" ? (
                      <button onClick={() => suspendUser(user.id)}>Suspend</button>
                    ) : (
                      <button onClick={() => removeSuspension(user.id)}>Remove Suspension</button>
                    )}
                    <button onClick={() => deleteUser(user.id)}>Delete</button>
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
