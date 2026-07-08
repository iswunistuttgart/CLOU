FROM python:3.10-slim AS builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

# Compile bytecode
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Default to CPU wheels for compatibility. Override to CUDA on NVIDIA hosts.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

# Copy dependency files
COPY pyproject.toml /app/

# Install dependencies into venv
RUN uv venv && \
    uv pip install --index-url ${TORCH_INDEX_URL} torch && \
    uv pip install "fastapi[standard]" sentence-transformers

# Final stage - minimal image
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy uv binary
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

# Copy venv from builder
COPY --from=builder /app/.venv /app/.venv

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Compile bytecode
ENV UV_COMPILE_BYTECODE=1

# Copy application files
COPY main.py /app/

CMD ["fastapi", "run", "--workers", "1", "main.py", "--host", "0.0.0.0", "--port", "8000"]