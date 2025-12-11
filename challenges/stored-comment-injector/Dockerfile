# ============================================================
# Stage 1 — Build Go binary
# ============================================================
FROM golang:1.23-bullseye AS builder

WORKDIR /app

# Cache dependencies first (faster rebuilds)
COPY go.mod go.sum ./
RUN go mod download

# Copy and build the Go challenge
COPY . .
RUN go build -o storedxss storedxss.go


# ============================================================
# Stage 2 — Runtime (lightweight & optimized)
# ============================================================
FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------
# 1. Install only essentials and use Node 18 LTS
# ------------------------------------------------------------
RUN apt-get update && apt-get install -y curl ca-certificates python3 supervisor \
 && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
 && apt-get install -y nodejs chromium \
 && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# 2. Set up app directory and copy only what’s needed
# ------------------------------------------------------------
WORKDIR /app
COPY --from=builder /app/storedxss /usr/local/bin/storedxss
COPY package*.json ./
COPY admin-bot.js supervisord.conf ./
COPY README.md ./

# ------------------------------------------------------------
# 3. Install only production dependencies, skip Chromium download
# ------------------------------------------------------------
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --omit=dev --prefer-offline --no-audit

# Puppeteer uses system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ------------------------------------------------------------
# 4. Copy any remaining Go or static assets if needed
# ------------------------------------------------------------
COPY storedxss.go /app/storedxss.go

# Ensure Supervisor has logs folder
RUN mkdir -p /var/log/supervisor

# Expose web server port
EXPOSE 8000

# ------------------------------------------------------------
# 5. Start both processes
# ------------------------------------------------------------
CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf"]
