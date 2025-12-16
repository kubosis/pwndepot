import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

export const FRONTEND_MODE =
  import.meta.env.VITE_FRONTEND_MODE || "dev";

// -----------------------------
// AXIOS INSTANCE
// -----------------------------
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, 
  // prod - send cookies
  // dev - do NOT send cookies
});

// -----------------------------
// GLOBAL 401 HANDLER
// -----------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("401 → Session expired or unauthorized.");

      if (FRONTEND_MODE === "prod") {
        // In prod, cookies expired - force logout
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
