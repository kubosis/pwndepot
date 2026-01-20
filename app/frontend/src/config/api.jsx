import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const FRONTEND_MODE = import.meta.env.VITE_FRONTEND_MODE || "dev";

// -----------------------------
// AXIOS INSTANCE
// -----------------------------
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true,
});

// -----------------------------
// GLOBAL 401 HANDLER (refresh flow)
// -----------------------------
let isRefreshing = false;
let refreshPromise = null;

// ENDPOINTS which can't trigger refresh
const NO_REFRESH_ENDPOINTS = [
  "/users/login",
  "/users/register",
  "/users/verify-email",
  "/users/resend-verification",
  "/users/auth/refresh",
  "/users/logout",
  "/users/forgot-password",
  "/users/reset-password",
  "/ctf-status",
  "/ctf-start",
  "/ctf-stop",
  "/users/me",
  "/users/me/solved",
  "/teams/me/solved",
  "/teams/myteam",
  "/teams/myteam/invite",
  // MFA endpoints
  "/mfa/admin/verify",
  "/mfa/verify",
  "/mfa/setup",
  "/mfa/enable",
];

function normalizePath(url) {
  if (!url) return "";

  let p = url;
  try {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      p = new URL(p).pathname;
    }
  } catch { /* ignore */}

  p = p.split("?")[0];

  if (!p.startsWith("/")) p = "/" + p;

  p = p.replace(/^\/api\/v1/, "");

  return p;
}

// -----------------------------
// CTF END detection helper
// -----------------------------
function getErrorCode(error) {
  return (
    error?.response?.data?.code ||
    error?.response?.data?.detail?.code ||
    null
  );
}

function isCtfEndedError(error) {
  const status = error?.response?.status;
  if (status !== 403) return false;
  return getErrorCode(error) === "CTF_ENDED";
}

function isAdminSurface() {
  try {
    const path = window.location?.pathname || "";
    return path.startsWith("/admin");
  } catch {
    return false;
  }
}

function notifyCtfEnded() {
  // Persist so refresh/reload keeps the state
  try {
    localStorage.setItem("ctfActive", "false");
  } catch {
    // ignore storage errors
  }

  // Let the app react immediately
  window.dispatchEvent(new Event("ctf-ended"));
}

function hardLogoutIfNonAdmin() {
  /**
   * We cannot reliably know the user's role inside axios without importing app state.
   * So we do a best-effort approach:
   * - If user is currently on /admin, we assume admin surface and do NOT logout.
   * - Otherwise, we logout (regular user experience).
   *
   * This keeps admin working after CTF ends, while kicking normal users out.
   */
  // Admin surface should stay functional (even after CTF ends)
  if (isAdminSurface()) return;

  window.dispatchEvent(new Event("auth-logout"));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const requestPath = normalizePath(originalRequest?.url || "");

    // -----------------------------------------
    // 1) GLOBAL CTF_ENDED handling (403)
    // -----------------------------------------
    if (isCtfEndedError(error)) {
      notifyCtfEnded();

      // Hard-logout regular users (admin stays functional)
      // Extra safety: don't logout if this looks like admin login request
      hardLogoutIfNonAdmin();

      return Promise.reject(error);
    }

    // -----------------------------------------
    // 2) 401 refresh flow 
    // -----------------------------------------
    const shouldSkipRefresh = NO_REFRESH_ENDPOINTS.some((endpoint) => {
      const ep = normalizePath(endpoint);
      return requestPath === ep;
    });

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkipRefresh
    ) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
        isRefreshing = true;

        refreshPromise = api
          .post("/users/auth/refresh")
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
      }

      await refreshPromise;
      return api(originalRequest);
      } catch (refreshError) {
        const st = refreshError?.response?.status;
        if (st !== 401 && st !== 403) {
          window.dispatchEvent(new Event("auth-logout"));
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

function getCookieValue(name) {
  try {
    const m = document.cookie.match(
      new RegExp("(^|;\\s*)" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[2]) : null;
  } catch {
    return null;
  }
}

api.interceptors.request.use(
  (config) => {
    // Add CSRF header only for "unsafe" methods
    const method = (config.method || "get").toLowerCase();
    const unsafe = ["post", "put", "patch", "delete"].includes(method);

    if (unsafe) {
      // standard names: "csrf_token" / "XSRF-TOKEN" / etc. - set this one from backend
      const csrf =
        getCookieValue("csrf_token") || getCookieValue("XSRF-TOKEN") || null;

      if (csrf) {
        config.headers = config.headers || {};
        config.headers["X-CSRF-Token"] = csrf;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);