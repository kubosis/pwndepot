import { api } from "../config/api";

export async function redirectIfLoggedIn(navigate, to = "/") {
  try {
    // 200 => fully logged in
    await api.get("/users/me");
    navigate(to, { replace: true });
  } catch (e) {
    // If user has a partial (MFA) session, backend returns MFA_REQUIRED
    const code =
      e?.response?.data?.detail?.code ||
      e?.response?.data?.code ||
      null;

    if (code === "MFA_REQUIRED") {
      navigate("/mfa-verify", { replace: true });
    }
    // else: truly not logged in -> stay on /login or /register
  }
}