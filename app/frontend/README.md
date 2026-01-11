# Frontend Application

A modern frontend application built with **React + Vite**.  
It provides user authentication, team management, rankings, an admin dashboard, legal policy pages and challenges page.

## 🚀 Features

- User login & registration
- Profile management and password change
- Create or join teams
- Team and user rankings
- Admin dashboard
- Legal pages (Privacy Policy, Terms of Service, Acceptable Use Policy, Legal Notice)
- Responsive UI with reusable React components

## 🛠️ Tech Stack

- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [JavaScript ES6+](https://developer.mozilla.org/docs/Web/JavaScript)
- [CSS Modules](https://github.com/css-modules/css-modules)

## 📦 Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/kubosis/ISEP_CyberSec.git
cd ISEP_CyberSec/app/frontend
npm install
```

## ▶️ Development

Run the development server:

```bash
npm run dev
```

The app will be available at http://localhost:5173 (Or next available port)

## 🏗️ Production Build

Create an optimized production build:

```bash
npm run build
```

## 📖 Project Structure

```plaintext
src/
├── assets/          # static assets (images, icons)
├── components/      # UI components and page views
├── utils/           # utility functions
├── config/          # environment & demo configuration
├── App.jsx          # root component
├── main.jsx         # entry point
└── index.css        # global styles
```

## 📜 Environment Variables

Create a `.env.development` file in the `app/frontend/` folder to configure environment variables:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_DEMO_MODE=true
```

For production deployments, create a `.env.production` file (not committed to Git):

```bash
VITE_API_URL=https://your-production-api.example.com/api
VITE_DEMO_MODE=false
```

## ⚠️ Demo Mode

This frontend includes a **Demo Mode** for local testing and presentation purposes.

When `VITE_DEMO_MODE=true` (default in `.env.development`):
- All user and admin data are stored locally in the browser (`localStorage`).
- Authentication and password hashing (SHA-256) are simulated only.
- The "Demo Mode Active" banner will appear at the top of the app.
- No real backend or API communication occurs.

When `VITE_DEMO_MODE=false` (production build):
- Authentication and authorization are expected to be handled securely by a backend.
- The banner and demo data are automatically disabled.

## 🔒 Security Notes
In demo mode, data is stored only in the browser for UX demonstration - do not use real credentials.

In production, all sensitive logic (authentication, hashing, sessions, CSRF protection)
must be implemented on the backend:

- Secure password hashing (Argon2id / bcrypt)

- HttpOnly, Secure cookies for session tokens

- Proper CORS and CSRF protection

- Content Security Policy (CSP) and strict security headers

- Never deploy demo mode with real users or sensitive information.

## 🧩 Frontend Patch - Demo Mode / Security Responsibilities and Fixes / Documentation


## 🔐 Security & Architecture Improvements
- Improved overall frontend security structure.
- Moved real password hashing responsibilities to the **backend** (Argon2id).
- Frontend hashing (`SHA-256`) is now **used only in demo mode** for obfuscation, not for real authentication.
- Added clear security documentation and guidance on HTTPS, secure cookies, and backend session handling.
- Prevented confusion between demo localStorage data and secure backend storage.

---

## ⚙️ Demo Mode Implementation
- Introduced `VITE_DEMO_MODE` environment flag to enable or disable demo mode.
- Added support for `.env.development`, `.env.production`, and `.env.example` configuration files.
- Created `src/config/demo.ts` to manage demo environment logic.
- Added visible **“Demo Mode Active”** banner displayed when running in demo mode.
- Disabled real API requests while in demo mode (mock/local behavior only).

---

## 🧱 Frontend Enhancements
- Added new **DemoBanner** component with non-blocking interactions (`pointer-events-none`).
- Updated layout spacing and z-index layers for consistent UI alignment.
- Added responsive, fixed positioning for demo indicators across all pages.
- Minor design improvements and accessibility polish.

---

## 🧰 Codebase Cleanup
- Updated `App.jsx` with improved routing comments and backend integration notes.
- Clarified authentication and session-handling logic with inline documentation.
- Updated `passwordUtils.jsx`:
  - Retained password strength evaluation logic.
  - Limited frontend hashing to demo only (later to change to backend only).
- Added safe defaults and error handling for environment variables.

---

## 📜 Documentation
- Updated **README.md** with:
  - Demo mode explanation
  - Security notes
  - Example `.env` setup
  - Backend integration guidance
- Added consistent formatting and clear structure for developers and reviewers.

---

**Summary:**  
This patch introduces **a safer, more modular frontend**, a clear **demo mode**, and improved **documentation** explaining secure practices for real-world deployment.

## 👥 Authors
Paweł Jamroziak