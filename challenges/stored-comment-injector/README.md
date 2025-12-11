# Stored Comment Injector — Developer README

> **For developers / maintainers only.**  
> This repository contains a CTF challenge (intentionally vulnerable). **Do not** run it on public infrastructure without proper isolation. This README explains *how to build, run, and maintain* the challenge — it does **not** reveal solutions or attack surfaces.

---

## Quick overview (high level)
This project includes:
- A Go backend (server source)  
- A small Node admin bot (headless browser script)  
- A `Dockerfile` and `supervisord.conf` to build and run everything in one container

Both server and bot sources are available in the repository. `supervisord` is used to run both processes together during testing.

---

## Prerequisites (for local dev)
- **Docker** (recommended) — latest stable  
- Or, to run without Docker:
  - **Go** 1.20+ (or the version pinned in `go.mod`)  
  - **Node.js** 18+ and **npm**

---

## Environment variables
Use a local `.env` for development overrides (do **not** commit real secrets). Example placeholders:

```
ADMIN_SECRET=change_me
CTF_FLAG=flag{change_me}
```

---

## Build (recommended: Docker)

Build image from project root:

```bash
docker build -t storedxss .
```

Run container (foreground):

```bash
docker run --rm -p 8000:8000 storedxss
```

Run detached:

```bash
docker run -d --name storedxss -p 8000:8000 storedxss
docker logs -f storedxss
```

Stop & remove:

```bash
docker stop storedxss
docker rm storedxss
```

Open: `http://localhost:8000`

---

## Run locally (no Docker)

1. Install Go dependencies and generate `go.sum`:

```bash
go mod tidy
```

2. Run the backend:

```bash
go run storedxss.go
# server listens on :8000 by default
```

3. In another terminal, install Node dependencies and run the admin bot:

```bash
npm install
# if you prefer system Chromium:
# export PUPPETEER_SKIP_DOWNLOAD=true
# export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
node admin-bot.js
```

---

# View container logs

```
docker logs -f <container_name_or_id>
```

---

## Contributing / changes
- Keep changes limited to configuration for packaging or deployment.
- Avoid changing challenge logic unless intentionally updating the challenge.
- When changing environment variables, update `.env.example`.

---
