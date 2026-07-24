FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:548d93f8a18a1acbe6cc127bc4f47281430d34a9e35c18afa80a8d6741c2adc3 AS linting-build

WORKDIR /src

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY services/linting /src/services/linting

RUN if [ ! -d /src/services/linting/UA-ModelCompiler/Opc.Ua.ModelCompiler ]; then \
    git clone https://github.com/OPCFoundation/UA-ModelCompiler.git /src/services/linting/UA-ModelCompiler; \
    fi

RUN dotnet publish /src/services/linting/App/CLOU.Linting.csproj \
    -c Release \
    -r linux-x64 \
    --self-contained \
    -p:PublishSingleFile=true \
    -p:InvariantGlobalization=true \
    -o /out/linting

FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:548d93f8a18a1acbe6cc127bc4f47281430d34a9e35c18afa80a8d6741c2adc3 AS metrics-build

WORKDIR /src

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY services/metrics /src/services/metrics

RUN if [ ! -d /src/services/metrics/UA-ModelCompiler/Opc.Ua.ModelCompiler ]; then \
    git clone https://github.com/OPCFoundation/UA-ModelCompiler.git /src/services/metrics/UA-ModelCompiler; \
    fi

RUN dotnet publish /src/services/metrics/Metrics/Metrics.csproj \
    -c Release \
    -r linux-x64 \
    --self-contained \
    -p:PublishSingleFile=true \
    -p:InvariantGlobalization=true \
    -o /out/metrics

FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app/

# Install uv
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#installing-uv
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

# Place executables in the environment at the front of the path
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#using-the-environment
ENV PATH="/app/.venv/bin:$PATH"

# Compile bytecode
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#compiling-bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

# Install psql for backup restoration of sql files
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency files first
COPY backend/pyproject.toml backend/uv.lock /app/

# Install dependencies
RUN uv sync --frozen --no-install-workspace --package app

ENV PYTHONPATH=/app

COPY backend/scripts /app/scripts

RUN mkdir -p /app/data
COPY backend/data/db-backup.sql /app/data/db-backup.sql

COPY backend/alembic.ini /app/

COPY backend/app /app/app

# Fail the image build early if Alembic config or migration discovery is broken.
RUN alembic -c /app/alembic.ini heads > /dev/null

RUN mkdir -p /app/tools
COPY --from=linting-build /out/linting/CLOU.Linting /app/tools/CLOU.Linting
COPY --from=metrics-build /out/metrics/Metrics /app/tools/Metrics
RUN chmod 755 /app/tools/CLOU.Linting /app/tools/Metrics

LABEL org.opencontainers.image.licenses="Apache-2.0"

# Final sync
RUN uv sync --frozen --package app && rm -rf /root/.cache/uv

# Backend can now use multiple workers - embedding model is in separate service
CMD ["fastapi", "run", "--workers", "4", "app/main.py", "--host", "0.0.0.0"]
