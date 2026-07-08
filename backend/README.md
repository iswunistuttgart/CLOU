# CLOU Backend

CLOU is a platform for analyzing and improving OPC UA model quality through semantic search, metrics analysis and linting.

> **For running CLOU**: See [README.md](../README.md) - only Docker is required.

## Development Setup

### Requirements

- [Docker](https://www.docker.com/)
- [uv](https://docs.astral.sh/uv/) for Python package management

### 1. Install Dependencies

```bash
cd backend
uv sync
source .venv/bin/activate
```

### 2. Start Docker Stack

From the repository root:

```bash
docker compose up -d
```

### 3. Run Locally with Hot Reload

```bash
fastapi run --reload app/main.py
```

## Database Migrations

Models are defined in `app/models.py`. Migrations use Alembic.

Create a migration after model changes:

```bash
docker compose exec backend alembic revision --autogenerate -m "description"
docker compose exec backend alembic upgrade head
```

## Populating the Database

The database can be populated or updated via the REST API. See the API documentation at http://localhost:8000/docs for available endpoints.

## Key Files

| File | Purpose |
|------|---------|
| `app/models.py` | SQLModel database models |
| `app/api/` | API endpoints |
| `app/crud.py` | Database operations |
| `app/services/` | Business logic |
| `scripts/` | Utility scripts |
| `app/alembic/` | Database migrations |

## Linting & Metrics

C# binaries are built during Docker image creation from:
- `services/linting/App/CLOU.Linting.csproj`
- `services/metrics/Metrics/Metrics.csproj`

At runtime, the backend uses the bundled binaries in `tools/`.

## License

Licensed under the Apache License 2.0. See [LICENSE](../LICENSE) file for details.