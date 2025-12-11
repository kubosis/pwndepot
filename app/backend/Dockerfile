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

RUN apt-get update

COPY app/backend/pyproject.toml app/backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY app/backend /project/app/backend

ENV PATH="/project/.venv/bin:$PATH"

EXPOSE 8000

CMD python -m app.backend.create_db && \
    uvicorn app.backend.main:app \
    --host 0.0.0.0 \
    --port 8000

