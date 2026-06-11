FROM oven/bun:1.3.10 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY backend/pyproject.toml backend/uv.lock ./backend/
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

WORKDIR /app
COPY backend/app ./backend/app
COPY csv ./csv
COPY exemptions.json support_tracking.json ./
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 10000
CMD ["sh", "-c", "cd /app/backend && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
