# CTF Infrastructure Server – Backend

FastAPI backend for the **CTF Infrastructure Server**.  
Provides authentication, users, teams, challenges, and scoring APIs.

---

## 🚀 Tech Stack

- **Python 3.11**
- **FastAPI**
- **Uvicorn**
- **SQLAlchemy (async)**
- **SQLite (dev)**
- **Pydantic v2**
- **SlowAPI (rate limiting)**
- **Docker & Docker Compose**
- **uv (Astral)** for dependency management

---

## 📁 Project Structure

```
app/backend/
├── api/
│ └── v1/
│ ├── routes/
│ └── router.py
├── config/
│ └── settings.py
├── db/
│ ├── base.py
│ ├── models.py
│ └── session.py
├── create_db.py
├── main.py
├── logging_config.py
├── pyproject.toml
└── uv.lock
```

---

## ⚙️ Environment Variables

Create a `.env` file (used both locally and in Docker):

```env
ENV=dev

SQLALCHEMY_DATABASE_URL=sqlite+aiosqlite:///./dev.db
RATE_LIMIT_PER_MINUTE=60

SERVER_HOST=0.0.0.0
SERVER_PORT=8000

ACCESS_TOKEN_EXPIRE_MINUTES=60

JWT_ALGORITHM=HS256
SECRET_KEY=supersecretdevkey_must_be_32_chars_long!!
HASHING_PEPPER=dev_pepper_123

SERVER_WORKERS=1

ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## 🧪 Local Development (without Docker)
1️⃣ Install dependencies
This project uses uv:

```bash
pip install uv
uv sync
```
2️⃣ Create database
```bash
python -m app.backend.create_db
```
3️⃣ Run backend
```bash
python app/backend/main.py
```
Backend will be available at:

```arduino
http://localhost:8000
```
API Docs:

Swagger: http://localhost:8000/docs

OpenAPI: http://localhost:8000/openapi.json

---

## 🐳 Docker / Docker Compose (Recommended)
1️⃣ Build images
```bash
docker compose build
```

or (clean build):

```bash
docker compose build --no-cache
```
2️⃣ Start services
```bash
docker compose up
```

## This will:

- build backend & frontend

- create the database automatically

- start FastAPI + Vite frontend

## Backend:

```arduino
http://localhost:8000
```

## Frontend:

```arduino
http://localhost:5173
```

---

## 🧹 Stop & Cleanup
```bash
docker compose down
```

---

## 🛠 Database Initialization (Docker)
Database tables are created automatically on container startup via:

```bash
python -m app.backend.create_db
```
This is executed before starting Uvicorn inside the container.

🌐 CORS Configuration
CORS is fully dynamic and controlled by:

```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
Internally converted to a list and applied via:

```python
allow_origins=settings.ALLOWED_ORIGINS_LIST
```

---

## ✅ Works both locally and in Docker.

## 🔐 Authentication
JWT-based authentication

Access tokens stored in HttpOnly cookies

Secure cookie settings switch automatically between dev and prod

## 🚦 Rate Limiting
Global rate limit:

```ini
RATE_LIMIT_PER_MINUTE=60
Powered by SlowAPI.
```

✅ Health Check
You can verify backend availability:

```bash
curl http://localhost:8000/docs
```

---

## 🧠 Common Issues
❌ ERR_EMPTY_RESPONSE
Check that ALLOWED_ORIGINS matches frontend port

Ensure backend is bound to 0.0.0.0 in Docker

Verify environment variables inside container:

```bash
docker exec -it fastapi_backend env
```
❌ OPTIONS 400
Usually indicates incorrect CORS configuration

Make sure frontend origin is listed in ALLOWED_ORIGINS

✅ Production Notes
Set ENV=prod

Use PostgreSQL instead of SQLite

Enable HTTPS

Use a strong SECRET_KEY

Set proper COOKIE_DOMAIN

