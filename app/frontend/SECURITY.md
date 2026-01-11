# Security Notice

This project includes a **Demo Mode** for local testing.

## Demo Mode
- Enabled when `VITE_DEMO_MODE=true`.
- All user data and authentication state are stored in browser `localStorage`.
- Passwords are hashed with SHA-256 for demonstration purposes.
- Contains mock data and fake users.
- No real backend, API calls, or sensitive data.

## Production Mode
When `VITE_DEMO_MODE=false`:
- Authentication and sessions are handled server-side.
- Passwords should be hashed with Argon2(To Add on backend)
- Passwords are hashed with SHA-256 for demonstration purposes.
- Tokens/sessions use HttpOnly cookies.
- CSRF protection, CORS, and CSP should be enforced by the backend(TO DO).

### Reminder
Do **not** use real credentials in demo mode.
