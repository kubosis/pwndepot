FROM python:3.11-slim

# install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Prevent Python from writing pyc files to disc
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/project
ENV UV_COMPILE_BYTECODE=1

ENV RUNNING_IN_DOCKER=1

WORKDIR /project

RUN apt-get update && apt-get install -y libpq-dev postgresql-client build-essential && rm -rf /var/lib/apt/lists/*

COPY app/backend/pyproject.toml app/backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY app/backend /project/app/backend
COPY assets/pwndepot_standard.png /project/assets/pwndepot_standard.png

ENV PATH="/project/.venv/bin:$PATH"

RUN addgroup --system app && adduser --system --ingroup app appuser && \
    chown -R appuser:app /project

EXPOSE 8000

USER appuser

CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]