# --- Stage 1: Build the React Application ---
FROM node:22-slim AS builder

ENV VITE_API_URL=""
ENV VITE_API_BASE_URL=""

WORKDIR /project
COPY app/frontend/package.json app/frontend/package-lock.json* /project/app/frontend/

WORKDIR /project/app/frontend

RUN npm ci

COPY app/frontend /project/app/frontend

RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

COPY --from=builder /project/app/frontend/dist /usr/share/nginx/html
COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Expose port 80
EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]