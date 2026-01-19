// src/components/AdminPage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DEMO_MODE } from "../config/demo";
import { api } from "../config/api";
import MFAInput from "../components/MFAInput";

/**
 * AdminPage (terminal red-zone)
 * - Restores old MFA functionality (login MFA + per-action MFA for delete/suspend)
 * - Fixes redesign bugs by separating MFA state for: login / delete / status
 * - IMPORTANT FIX: store modal targets as IDs (not objects) to avoid stale references
 * - Keeps redesign UI structure, adds a clear "terminal-style" MFA gate box
 *
 * NOTE (Show/Hide):
 * - Adds Show/Hide toggles everywhere: admin login password, login MFA code, modal admin password, modal MFA codes
 * - Requires MFAInput to accept optional `type` prop (text/password).
 */
export default function AdminPage({ loggedInUser, setLoggedInUser, onLogout, ctfActive, ctfSecondsLeft }) {
  const initialTime = 7 * 24 * 3600; // 7 days in seconds

  // -------------------------
  // Auth state
  // -------------------------
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState("");

  // IMPORTANT: separate MFA codes per surface (fixes modal bugs)
  const [loginMfaCode, setLoginMfaCode] = useState("");

  // -------------------------
  // Show / Hide toggles (Register-like)
  // -------------------------
  const [showAdminLoginPassword, setShowAdminLoginPassword] = useState(false);
  const [showLoginMfa, setShowLoginMfa] = useState(false);

  const [showModalAdminPassword, setShowModalAdminPassword] = useState(false);

  const [showDeleteMfa, setShowDeleteMfa] = useState(false);
  const [showStatusMfa, setShowStatusMfa] = useState(false);

  // -------------------------
  // CTF controls
  // -------------------------
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [ctfRunning, setCtfRunning] = useState(false);
  const [blast, setBlast] = useState(false);
  const [, setCtfEnded] = useState(false);
  const prevTimeLeftRef = useRef(timeLeft);

  // -------------------------
  // Users table
  // -------------------------
  const [users, setUsers] = useState([]);

  // -------------------------
  // Modal state (delete / status)
  // IMPORTANT FIX: keep targets as IDs to avoid stale object references
  // -------------------------
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [statusTargetId, setStatusTargetId] = useState(null);

  const deleteTarget = useMemo(
    () => users.find((u) => u.id === deleteTargetId) || null,
    [users, deleteTargetId]
  );
  const statusTarget = useMemo(
    () => users.find((u) => u.id === statusTargetId) || null,
    [users, statusTargetId]
  );

  const [adminPassword, setAdminPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [statusError, setStatusError] = useState("");

  // Separate MFA step + code per modal (fixes "error when MFA enabled")
  const [deleteMfaStep, setDeleteMfaStep] = useState(false);
  const [deleteMfaCode, setDeleteMfaCode] = useState("");

  const [statusMfaStep, setStatusMfaStep] = useState(false);
  const [statusMfaCode, setStatusMfaCode] = useState("");

  const [modalLoading, setModalLoading] = useState(false);

  const minDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // -------------------------
  // Helpers
  // -------------------------
  const isAdmin = loggedInUser?.role === "admin";

  const formatTime = (s) => {
    const sec = Math.max(0, Number(s) || 0);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(h)}:${pad(m)}:${pad(ss)}`;
  };

  // Login disabled logic
  const canAdminLogin = !!formData.email.trim() && !!formData.password.trim() && !loading && !mfaRequired;
  const canVerifyLoginMfa = !!loginMfaCode.trim() && !loading;

  // Modal disabled logic
  const canConfirmDeleteNoMfa = !!adminPassword.trim() && !!deleteTarget && !modalLoading && !deleteMfaStep;
  const canConfirmStatusNoMfa = !!adminPassword.trim() && !!statusTarget && !modalLoading && !statusMfaStep;

  const canVerifyDeleteMfa =
    !!adminPassword.trim() && !!deleteMfaCode.trim() && !!deleteTarget && !modalLoading && deleteMfaStep;

  const canVerifyStatusMfa =
    !!adminPassword.trim() && !!statusMfaCode.trim() && !!statusTarget && !modalLoading && statusMfaStep;

  // -------------------------
  // CTF controls
  // -------------------------
  const startCTF = async () => {
    setErrorMessage("");
    if (DEMO_MODE) {
      setCtfRunning(true);
      setTimeLeft(initialTime);
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
      return;
    }

    try {
      await api.post("/ctf-start", { duration_seconds: initialTime });
      setCtfRunning(true);
      setCtfEnded(false);

      // global refresh in App.jsx:
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
    } catch {
      setErrorMessage("Failed to start CTF");
    }
  };

  const stopCTF = async () => {
    setErrorMessage("");
    if (DEMO_MODE) {
      setCtfRunning(false);
      setTimeLeft(initialTime);
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
      return;
    }

    try {
      await api.post("/ctf-stop");
      // UI local reset
      setCtfRunning(false);
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
    } catch {
      setErrorMessage("Failed to stop CTF");
    }
  };

  // -------------------------
  // Load users
  // -------------------------
  const loadUsers = useCallback(async () => {
    setErrorMessage("");
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
        (res.data || []).map((u) => ({
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
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    const seconds = typeof ctfSecondsLeft === "number" ? ctfSecondsLeft : null;

    // Backend tells: CTF is running
    if (ctfActive) {
      if (seconds !== null) setTimeLeft(seconds);

      // we count down if seconds > 0 or unknown (null)
      setCtfRunning(seconds === null ? true : seconds > 0);

      setCtfEnded(false);
      return;
    }

    // Backend tells: CTF is NOT running
    setCtfRunning(false);

    // UI reset to initial state (start button)
    if (seconds === 0) {
      setTimeLeft(initialTime);
    } else if (seconds !== null) {
      setTimeLeft(seconds);
    }

    setCtfEnded(false);
  }, [ctfActive, ctfSecondsLeft, initialTime]);

  useEffect(() => {
    const prev = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;

    if (!(prev > 0 && timeLeft === 0)) return;

    setBlast(true);
    setCtfRunning(false);

    const t = setTimeout(() => {
      setBlast(false);
      setTimeLeft(initialTime); // UI reset
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
    }, 900);

    return () => clearTimeout(t);
  }, [timeLeft, initialTime]);


  // -------------------------
  // Admin login
  // -------------------------
  const handleChange = (e) => {
    if (errorMessage) setErrorMessage("");
    if (mfaSuccess) setMfaSuccess("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAdminLogin) return;

    setLoading(true);
    setErrorMessage("");
    setMfaRequired(false);
    setLoginMfaCode("");
    setMfaSuccess("");

    // reset visibility for security
    setShowAdminLoginPassword(false);
    setShowLoginMfa(false);

    if (!formData.email.trim() || !formData.password.trim()) {
      setErrorMessage("Please fill out all fields.");
      setLoading(false);
      return;
    }

    if (DEMO_MODE) {
      setLoggedInUser?.({ role: "admin", username: "demo_admin" });
      loadUsers();
      setLoading(false);
      return;
    }

    try {
      const body = new URLSearchParams();
      body.append("username", formData.email.trim());
      body.append("password", formData.password);

      const res = await api.post("/users/admin/login" , body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      await minDelay(900);

      // MFA REQUIRED
      if (res.data?.mfa_required) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // NO MFA - normal login
      setMfaSuccess("Admin successfully logged in");
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));
      await minDelay(900);

      const meRes = await api.get("/users/me");
      setLoggedInUser?.(meRes.data);
      loadUsers();

      setMfaSuccess("");
      setLoading(false);
    } catch {
      await minDelay(900);
      setMfaRequired(false);
      setLoginMfaCode("");
      setErrorMessage("Invalid credentials or access denied");
      setMfaSuccess("");
      setLoading(false);
    }
  };

  // -------------------------
  // Logout
  // -------------------------
  const handleLogout = async () => {
    try {
      if (!DEMO_MODE) {
        await api.post("/users/logout");
      }
    } catch {
      // ignore
    } finally {
      onLogout?.();
      setUsers([]);
      setLoggedInUser?.(null);

      // auth
      setFormData({ email: "", password: "" });
      setMfaRequired(false);
      setLoginMfaCode("");
      setMfaSuccess("");
      setErrorMessage("");

      // visibility reset
      setShowAdminLoginPassword(false);
      setShowLoginMfa(false);
      setShowModalAdminPassword(false);
      setShowDeleteMfa(false);
      setShowStatusMfa(false);

      // modals
      setDeleteTargetId(null);
      setStatusTargetId(null);
      setAdminPassword("");

      setDeleteMfaStep(false);
      setDeleteMfaCode("");
      setDeleteError("");

      setStatusMfaStep(false);
      setStatusMfaCode("");
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

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [ctfRunning]);

  // -------------------------
  // Modal body scroll lock
  // -------------------------
  useEffect(() => {
    if (deleteTarget || statusTarget) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [deleteTarget, statusTarget]);

  // -------------------------
  // MFA verify on login screen (same behavior as old code)
  // FIX: better back flow + enter works + resets cleanly
  // -------------------------
  const verifyLoginMfa = async () => {
    if (!canVerifyLoginMfa) {
      setErrorMessage("MFA code is required");
      setShowLoginMfa(false);
      return;
    }

     setShowLoginMfa(false);

    setLoading(true);
    setErrorMessage("");
    setMfaSuccess("");

    try {
      await Promise.all([api.post("/mfa/verify", { code: loginMfaCode.trim() }), minDelay(900)]);

      setMfaSuccess("MFA verified. Logging in ...");
      await minDelay(900);

      const meRes = await api.get("/users/me");
      setLoggedInUser?.(meRes.data);
      loadUsers();
      window.dispatchEvent(new CustomEvent("ctf-refresh", { detail: { force: true } }));

      setMfaRequired(false);
      setLoginMfaCode("");
      setMfaSuccess("");
      setShowLoginMfa(false);
      setLoading(false);
    } catch {
      await minDelay(900);
      setErrorMessage("Invalid MFA code");
      setLoginMfaCode("");
      setMfaSuccess("");
      setShowLoginMfa(false);
      setLoading(false);
    }
  };

  const backFromLoginMfa = () => {
    // PERFECT reset: allows re-login immediately, clears errors & success
    setMfaRequired(false);
    setLoginMfaCode("");
    setMfaSuccess("");
    setErrorMessage("");
    setShowLoginMfa(false);
    setLoading(false);
  };

  // -------------------------
  // Delete flow helpers (restores old functionality)
  // -------------------------
  const openDeleteModal = (user) => {
    setDeleteTargetId(user.id);
    setAdminPassword("");
    setDeleteMfaStep(false);
    setDeleteMfaCode("");
    setDeleteError("");
    setMfaSuccess("");
    setModalLoading(false);

    // visibility reset
    setShowModalAdminPassword(false);
    setShowDeleteMfa(false);
  };

  const closeDeleteModal = () => {
    setDeleteTargetId(null);
    setAdminPassword("");
    setDeleteMfaStep(false);
    setDeleteMfaCode("");
    setDeleteError("");
    setMfaSuccess("");
    setModalLoading(false);

    // visibility reset
    setShowModalAdminPassword(false);
    setShowDeleteMfa(false);
  };

  const confirmDeleteNoMfa = async () => {
    if (!canConfirmDeleteNoMfa) return;

    setShowModalAdminPassword(false);

    setModalLoading(true);
    setDeleteError("");
    setMfaSuccess("");

    try {
      await api.delete(`/users/${deleteTarget.id}`, {
        data: { password: adminPassword },
      });

      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setMfaSuccess("User has been deleted successfully.");
      await minDelay(900);

      closeDeleteModal();
    } catch (err) {
      // IMPORTANT: if backend signals MFA required, switch to MFA step
      if (err?.response?.data?.detail?.code === "MFA_REQUIRED") {
        setDeleteMfaStep(true);
        setDeleteMfaCode("");
        setDeleteError("");
        setMfaSuccess("");
        setShowDeleteMfa(false);
        setShowModalAdminPassword(false);
        setModalLoading(false);
        return;
      }

      if (err?.response?.status === 403) {
        setDeleteError("Invalid admin password");
        setModalLoading(false);
        return;
      }

      setDeleteError("Delete failed");
      setModalLoading(false);
    } finally {
      setModalLoading(false);
    }
  };

  const confirmDeleteWithMfa = async () => {
    if (!canVerifyDeleteMfa) {
      setDeleteError(!adminPassword.trim() ? "Admin password is required" : "MFA code is required");
      return;
    }

    setShowDeleteMfa(false);
    setShowModalAdminPassword(false);

    setModalLoading(true);
    setDeleteError("");
    setMfaSuccess("");

    // Verify MFA for admin action
    try {
      await api.post("/mfa/admin/verify", { code: deleteMfaCode.trim() });
    } catch {
      setDeleteError("Invalid MFA code");
      setDeleteMfaCode("");
      setShowDeleteMfa(false);
      setModalLoading(false);
      return;
    }

    // Execute delete (WITH MFA)
    try {
      await api.delete(`/users/${deleteTarget.id}`, {
        data: { password: adminPassword },
      });

      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setMfaSuccess("MFA Verified. User has been deleted.");
      await minDelay(900);

      closeDeleteModal();
    } catch {
      setDeleteError("Delete failed");
      setModalLoading(false);
    } finally {
      setModalLoading(false);
    }
  };

  // -------------------------
  // Status flow helpers (restores old functionality)
  // -------------------------
  const openStatusModal = (user) => {
    setStatusTargetId(user.id);
    setAdminPassword("");
    setStatusMfaStep(false);
    setStatusMfaCode("");
    setStatusError("");
    setMfaSuccess("");
    setModalLoading(false);

    // visibility reset
    setShowModalAdminPassword(false);
    setShowStatusMfa(false);
  };

  const closeStatusModal = () => {
    setStatusTargetId(null);
    setAdminPassword("");
    setStatusMfaStep(false);
    setStatusMfaCode("");
    setStatusError("");
    setMfaSuccess("");
    setModalLoading(false);

    // visibility reset
    setShowModalAdminPassword(false);
    setShowStatusMfa(false);
  };

  const confirmStatusNoMfa = async () => {
    if (!canConfirmStatusNoMfa) return;

    setShowModalAdminPassword(false);

    setModalLoading(true);
    setStatusError("");
    setMfaSuccess("");

    const newStatus = statusTarget.status === "active" ? "suspended" : "active";

    try {
      await api.put(`/users/${statusTarget.id}/status`, {
        status: newStatus,
        password: adminPassword,
      });

      setUsers((prev) => prev.map((u) => (u.id === statusTarget.id ? { ...u, status: newStatus } : u)));

      setMfaSuccess(newStatus === "suspended" ? "User suspended successfully" : "User unsuspended successfully");
      await minDelay(900);

      closeStatusModal();
    } catch (err) {
      if (err?.response?.data?.detail?.code === "MFA_REQUIRED") {
        setStatusMfaStep(true);
        setStatusMfaCode("");
        setStatusError("");
        setMfaSuccess("");
        setShowStatusMfa(false);
        setShowModalAdminPassword(false);
        setModalLoading(false);
        return;
      }

      if (err?.response?.status === 403) {
        setStatusError("Invalid admin password");
        setModalLoading(false);
        return;
      }

      setStatusError("Failed to update user status");
      setModalLoading(false);
    } finally {
      setModalLoading(false);
    }
  };

  const confirmStatusWithMfa = async () => {
    if (!canVerifyStatusMfa) {
      setStatusError(!adminPassword.trim() ? "Admin password is required" : "MFA code is required");
      return;
    }

    setShowStatusMfa(false);
    setShowModalAdminPassword(false);

    setModalLoading(true);
    setStatusError("");
    setMfaSuccess("");

    // Verify MFA for admin action
    try {
      await api.post("/mfa/admin/verify", { code: statusMfaCode.trim() });
    } catch {
      setStatusError("Invalid MFA code");
      setStatusMfaCode("");
      setShowStatusMfa(false);
      setModalLoading(false);
      return;
    }

    const newStatus = statusTarget.status === "active" ? "suspended" : "active";

    // Execute status change (WITH MFA)
    try {
      await api.put(`/users/${statusTarget.id}/status`, {
        status: newStatus,
        password: adminPassword,
      });

      setUsers((prev) => prev.map((u) => (u.id === statusTarget.id ? { ...u, status: newStatus } : u)));

      setMfaSuccess(`MFA Verified. ${newStatus === "suspended" ? "User suspended successfully" : "User unsuspended successfully"}`);

      await minDelay(900);
      closeStatusModal();
    } catch {
      setStatusError("Failed to update status");
      setModalLoading(false);
    } finally {
      setModalLoading(false);
    }
  };

  // -------------------------
  // Derived
  // -------------------------
  const usersOnly = useMemo(() => users.filter((u) => u.role === "user"), [users]);

  // -------------------------
  // Login screen UI (red terminal)
  // -------------------------
  if (!isAdmin) {
    return (
      <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
        {/* Background layers */}
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage: "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,4,4,0.10)_0%,rgba(10,4,4,0.55)_55%,rgba(10,4,4,0.92)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 via-[#0a0404]/55 to-[#0a0404]/84" />
          <div className="absolute inset-0 bg-[#0a0404]/30" />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,120,120,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,120,120,0.12) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 3px, transparent 6px)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="auth-page">
            <div className="auth-shell">
              {/* left panel */}
              <aside className="auth-side">
                <div className="auth-side-inner">
                  <div className="admin-kicker">
                    <span className="admin-dot" />
                    secure://pwn-depot • admin
                  </div>

                  <div className="admin-title">
                    Restricted
                    <br />
                    <span className="admin-title-accent">control plane</span>
                  </div>

                  <div className="admin-subtitle">
                    Elevated privileges. Operations here can affect availability, integrity, and user access.
                  </div>

                  <ul className="admin-bullets">
                    <li>Admin login uses a dedicated endpoint and may require MFA.</li>
                    <li>All destructive actions may prompt MFA.</li>
                    <li>Audit your changes and keep credentials secure.</li>
                  </ul>

                  <div className="admin-chip">
                    <span className="admin-dot admin-dot-soft" />
                    <span>
                      zone: <code>red</code> • transport: <code>tls</code> • policy: <code>audit</code>
                    </span>
                  </div>
                </div>
              </aside>

              {/* login card */}
              <section className="admin-card">
                <div className="admin-card-inner">
                  <div className="admin-card-head">
                    <h2 className="admin-h2">Admin Login</h2>
                    <div className="admin-mini">{DEMO_MODE ? "demo" : "live"}</div>
                  </div>

                  {!mfaRequired && (
                    <form onSubmit={handleSubmit} className="admin-form" autoComplete="on">
                      <label className="admin-field">
                        <div className="admin-label">
                          <span>Email</span>
                          <span className="admin-hint">required</span>
                        </div>
                        <input
                          type="email"
                          name="email"
                          placeholder="admin@admin.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          disabled={loading || mfaRequired}
                          className="admin-input"
                          autoComplete="email"
                        />
                      </label>

                      <label className="admin-field">
                        <div className="admin-label">
                          <span>Password</span>
                          <span className="admin-hint">required</span>
                        </div>

                        {/* SHOW/HIDE */}
                        <div className="admin-input-wrap">
                          <input
                            type={showAdminLoginPassword ? "text" : "password"}
                            name="password"
                            placeholder="••••••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            disabled={loading || mfaRequired}
                            className="admin-input has-toggle"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="admin-toggle"
                            onClick={() => setShowAdminLoginPassword((v) => !v)}
                            aria-label={showAdminLoginPassword ? "Hide password" : "Show password"}
                            disabled={loading || mfaRequired}
                          >
                            {showAdminLoginPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>

                      <button type="submit" disabled={!canAdminLogin} className="admin-btn admin-btn-primary">
                        {loading ? "Authorizing..." : "Login"}
                      </button>

                      {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}
                      <div className="admin-feedback warn">Only authorized admins can log in.</div>
                    </form>
                  )}

                  {/* MFA login step (terminal-style gate) */}
                  {mfaRequired && (
                    <div className="admin-mfa-gate">
                      <div className="admin-mfa-gate-head">
                        <div className="admin-kicker">
                          <span className="admin-dot admin-dot-soft" />
                          step 2/2 • mfa verification
                        </div>
                        <div className="admin-topbar-title">Two-factor required</div>
                        <div className="admin-topbar-sub">
                          Enter a valid MFA or recovery code to unlock the control plane.
                        </div>
                      </div>

                      <div className="admin-mfa-gate-body">
                        <label className="admin-field">
                          <div className="admin-label">
                            <span>MFA code</span>
                            <span className="admin-hint">6-digit or backup</span>
                          </div>

                          {/* SHOW/HIDE */}
                          <div className="admin-input-wrap">
                            <MFAInput
                              value={loginMfaCode}
                              onChange={(v) => {
                                setLoginMfaCode(v);
                                if (errorMessage) setErrorMessage("");
                                if (mfaSuccess) setMfaSuccess("");
                              }}
                              allowBackup
                              disabled={loading}
                              type={showLoginMfa ? "text" : "password"}
                              className="has-toggle"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  verifyLoginMfa();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="admin-toggle"
                              onClick={() => setShowLoginMfa((v) => !v)}
                              aria-label={showLoginMfa ? "Hide MFA code" : "Show MFA code"}
                              disabled={loading}
                            >
                              {showLoginMfa ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>

                        {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}
                        {mfaSuccess && <div className="admin-feedback success">{mfaSuccess}</div>}

                        <div className="admin-mfa-gate-actions admin-mfa-gate-actions--row">
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={!canVerifyLoginMfa}
                            type="button"
                            onClick={verifyLoginMfa}
                          >
                            {loading ? "Verifying…" : "Verify MFA"}
                          </button>

                          <button
                            className="admin-btn admin-btn-ghost"
                            disabled={loading}
                            type="button"
                            onClick={backFromLoginMfa}
                          >
                            Back
                          </button>
                        </div>

                        {!loginMfaCode && <div className="admin-feedback warn">Tip: paste a 6-digit TOTP or a valid backup code.</div>}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------
  // Dashboard UI (red terminal)
  // -------------------------
  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-x-clip min-h-screen -mt-24 pt-24 pb-14">
      {/* Background layers */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NzIwIiwicGF0aCI6Ii9mLzc0NmQ1NTcxLWQ3ODQtNDA5NC1hMjRkLWEzYmRiYzdlMTAxMy9kZm9pajVrLTk2YzNmNjY1LWI0MzMtNDdhZC1hMmUwLTUxYzViNTBiZGU1My5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.ZEMLeYecpAeo-6CQlDfebfl-R_581TIy3en7K9UzfyU')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,4,4,0.10)_0%,rgba(10,4,4,0.55)_55%,rgba(10,4,4,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 via-[#0a0404]/55 to-[#0a0404]/84" />
        <div className="absolute inset-0 bg-[#0a0404]/30" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,120,120,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,120,120,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 3px, transparent 6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      {blast && <div className="admin-blast" />}

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Topbar */}
        <div className="admin-topbar">
          <div>
            <div className="admin-kicker">
              <span className="admin-dot" />
              SECURE://PWN-DEPOT • ADMIN
            </div>
            <div className="admin-topbar-title">Administration</div>
            <div className="admin-topbar-sub">
              Operator: <span className="mono">{loggedInUser?.username || "admin"}</span>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div className={`admin-timer ${ctfRunning ? "is-running" : "is-idle"}`}>
              <div className="admin-timer-label">CTF timer</div>
              <div className="admin-timer-value mono">{formatTime(timeLeft)}</div>
              <div className="admin-timer-meta">
                status: <span className="mono">{ctfRunning ? "running" : "idle"}</span>
              </div>
            </div>

            <div className="admin-actions">
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => (ctfRunning ? stopCTF() : startCTF())}
                disabled={modalLoading || loading}
                title={
                    (ctfRunning ? "Stop the CTF" : "Start the CTF")
                }
              >
                {ctfRunning ? "stop ctf" : "start ctf"}
              </button>

              <button className="admin-btn admin-btn-ghost" onClick={handleLogout} disabled={modalLoading || loading}>
                logout
              </button>
            </div>
          </div>
        </div>

        {/* Global feedback */}
        {errorMessage && <div className="admin-feedback error">{errorMessage}</div>}

        {/* Users surface */}
        <section className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <div className="admin-surface-title">Users</div>
              <div className="admin-surface-meta">Suspend or delete accounts. Some actions may require MFA.</div>
            </div>
            <div className="admin-surface-pill">
              count: <strong className="mono">{usersOnly.length}</strong>
            </div>
          </div>

          <div className="admin-table-wrap">
            {usersOnly.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="mono">ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersOnly.map((user) => (
                    <tr key={user.id}>
                      <td className="mono">{user.id}</td>
                      <td className="mono">{user.name}</td>
                      <td className="mono">{user.role}</td>
                      <td>
                        <span className={`admin-status ${user.status === "active" ? "ok" : "bad"}`}>
                          <span className="mono">{user.status}</span>
                        </span>
                      </td>
                      <td className="right">
                        <div className="admin-row-actions">
                          <button className="admin-btn admin-btn-soft" disabled={modalLoading} onClick={() => openStatusModal(user)}>
                            {user.status === "active" ? "Suspend" : "Unsuspend"}
                          </button>

                          <button className="admin-btn admin-btn-danger" disabled={modalLoading} onClick={() => openDeleteModal(user)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <div className="admin-modal-head">
              <div>
                <div className="admin-modal-title">Confirm deletion</div>
                <div className="admin-modal-meta">
                  Target: <span className="mono">{deleteTarget.name}</span>
                </div>
              </div>

              <button
                className="admin-icon-btn"
                onClick={closeDeleteModal}
                disabled={modalLoading}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-feedback warn">This action is destructive. It may require MFA depending on policy.</div>

              <label className="admin-field">
                <div className="admin-label">
                  <span>Admin password</span>
                  <span className="admin-hint">required</span>
                </div>

                {/* SHOW/HIDE */}
                <div className="admin-input-wrap">
                  <input
                    type={showModalAdminPassword ? "text" : "password"}
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (deleteError) setDeleteError("");
                      if (mfaSuccess) setMfaSuccess("");
                    }}
                    disabled={deleteMfaStep || modalLoading}
                    className="admin-input has-toggle"
                  />
                  <button
                    type="button"
                    className="admin-toggle"
                    onClick={() => setShowModalAdminPassword((v) => !v)}
                    aria-label={showModalAdminPassword ? "Hide password" : "Show password"}
                    disabled={deleteMfaStep || modalLoading}
                  >
                    {showModalAdminPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {deleteMfaStep && (
                <div className="admin-mfa-gate admin-mfa-gate--modal">
                  <div className="admin-mfa-gate-head">
                    <div className="admin-kicker">
                      <span className="admin-dot admin-dot-soft" />
                      mfa required • privileged operation
                    </div>
                    <div className="admin-topbar-title">Verify MFA</div>
                    <div className="admin-topbar-sub">This action requires an additional authentication step.</div>
                  </div>

                  <div className="admin-mfa-gate-body">
                    <label className="admin-field">
                      <div className="admin-label">
                        <span>MFA code</span>
                        <span className="admin-hint">required</span>
                      </div>

                      {/* SHOW/HIDE */}
                      <div className="admin-input-wrap">
                        <MFAInput
                          value={deleteMfaCode}
                          onChange={(v) => {
                            setDeleteMfaCode(v);
                            if (deleteError) setDeleteError("");
                            if (mfaSuccess) setMfaSuccess("");
                          }}
                          disabled={modalLoading}
                          placeholder="Enter MFA code"
                          allowBackup={false}
                          type={showDeleteMfa ? "text" : "password"}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              confirmDeleteWithMfa();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="admin-toggle"
                          onClick={() => setShowDeleteMfa((v) => !v)}
                          aria-label={showDeleteMfa ? "Hide MFA code" : "Show MFA code"}
                          disabled={modalLoading}
                        >
                          {showDeleteMfa ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>

                    {/* WARN */}
                    <div className="admin-feedback warn">Enter a valid MFA code to continue.</div>

                    {/* ERROR / SUCCESS */}
                    {deleteError && <div className="admin-feedback error">{deleteError}</div>}
                    {mfaSuccess && <div className="admin-feedback success">{mfaSuccess}</div>}
                  </div>
                </div>
              )}

              {!deleteMfaStep && deleteError && <div className="admin-feedback error">{deleteError}</div>}
              {!deleteMfaStep && mfaSuccess && <div className="admin-feedback success">{mfaSuccess}</div>}
            </div>

            <div className="admin-modal-actions">
              {!deleteMfaStep ? (
                <>
                  <button className="admin-btn admin-btn-danger" disabled={!canConfirmDeleteNoMfa} onClick={confirmDeleteNoMfa}>
                    {modalLoading ? "processing..." : "confirm delete"}
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-btn admin-btn-danger" disabled={!canVerifyDeleteMfa} onClick={confirmDeleteWithMfa}>
                    {modalLoading ? "verifying..." : "verify & delete"}
                  </button>

                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={modalLoading}
                    type="button"
                    onClick={() => {
                      setDeleteMfaStep(false);
                      setDeleteMfaCode("");
                      setDeleteError("");
                      setMfaSuccess("");
                      setShowDeleteMfa(false);
                    }}
                  >
                    back
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusTarget && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <div className="admin-modal-head">
              <div>
                <div className="admin-modal-title">{statusTarget.status === "active" ? "Confirm Suspension" : "Remove Suspension"}</div>
                <div className="admin-modal-meta">
                  Target: <span className="mono">{statusTarget.name}</span>
                </div>
              </div>

              <button
                className="admin-icon-btn"
                onClick={closeStatusModal}
                disabled={modalLoading}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-feedback warn">This operation changes account availability. It may require MFA depending on policy.</div>

              <label className="admin-field">
                <div className="admin-label">
                  <span>Admin password</span>
                  <span className="admin-hint">required</span>
                </div>

                {/* SHOW/HIDE */}
                <div className="admin-input-wrap">
                  <input
                    type={showModalAdminPassword ? "text" : "password"}
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (statusError) setStatusError("");
                      if (mfaSuccess) setMfaSuccess("");
                    }}
                    disabled={statusMfaStep || modalLoading}
                    className="admin-input has-toggle"
                  />
                  <button
                    type="button"
                    className="admin-toggle"
                    onClick={() => setShowModalAdminPassword((v) => !v)}
                    aria-label={showModalAdminPassword ? "Hide password" : "Show password"}
                    disabled={statusMfaStep || modalLoading}
                  >
                    {showModalAdminPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {statusMfaStep && (
                <div className="admin-mfa-gate admin-mfa-gate--modal">
                  <div className="admin-mfa-gate-head">
                    <div className="admin-kicker">
                      <span className="admin-dot admin-dot-soft" />
                      mfa required • privileged operation
                    </div>
                    <div className="admin-topbar-title">Verify MFA</div>
                    <div className="admin-topbar-sub">This action requires an additional authentication step.</div>
                  </div>

                  <div className="admin-mfa-gate-body">
                    <label className="admin-field">
                      <div className="admin-label">
                        <span>MFA code</span>
                        <span className="admin-hint">required</span>
                      </div>

                      {/* SHOW/HIDE */}
                      <div className="admin-input-wrap">
                        <MFAInput
                          value={statusMfaCode}
                          onChange={(v) => {
                            setStatusMfaCode(v);
                            if (statusError) setStatusError("");
                            if (mfaSuccess) setMfaSuccess("");
                          }}
                          disabled={modalLoading}
                          placeholder="Enter MFA code"
                          allowBackup={false}
                          type={showStatusMfa ? "text" : "password"}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              confirmStatusWithMfa();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="admin-toggle"
                          onClick={() => setShowStatusMfa((v) => !v)}
                          aria-label={showStatusMfa ? "Hide MFA code" : "Show MFA code"}
                          disabled={modalLoading}
                        >
                          {showStatusMfa ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>

                    <div className="admin-feedback warn">This action requires MFA verification.</div>

                    {statusError && <div className="admin-feedback error">{statusError}</div>}
                    {mfaSuccess && <div className="admin-feedback success">{mfaSuccess}</div>}
                  </div>
                </div>
              )}

              {!statusMfaStep && statusError && <div className="admin-feedback error">{statusError}</div>}
              {!statusMfaStep && mfaSuccess && <div className="admin-feedback success">{mfaSuccess}</div>}
            </div>

            <div className="admin-modal-actions">
              {!statusMfaStep ? (
                <>
                  <button className="admin-btn admin-btn-danger" disabled={!canConfirmStatusNoMfa} onClick={confirmStatusNoMfa}>
                    {modalLoading ? "processing..." : "confirm"}
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-btn admin-btn-danger" disabled={!canVerifyStatusMfa} onClick={confirmStatusWithMfa}>
                    {modalLoading ? "verifying..." : "verify & confirm"}
                  </button>

                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={modalLoading}
                    type="button"
                    onClick={() => {
                      setStatusMfaStep(false);
                      setStatusMfaCode("");
                      setStatusError("");
                      setMfaSuccess("");
                      setShowStatusMfa(false);
                    }}
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
