# CLOU

CLOU is a platform for analyzing and improving OPC UA model quality through semantic search, metrics analysis and linting.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Quick Start

First build (required on first run):

```bash
docker compose up --build
```

Subsequent starts:

```bash
docker compose up
```

Services:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Database**: localhost:5432

### GPU Support

For GPU-accelerated embeddings (requires NVIDIA GPU + nvidia-docker):

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Note: The GPU embedding image requires significantly more memory than the CPU version, but slightly improves the search speed.

### Import Profile

For imports to the database, start the catch-up worker for embedding:

```bash
docker compose --profile import up -d embedding-catchup-worker
```

### Stopping

```bash
docker compose down
```

## Configuration

Environment variables are defined in `backend/.env`. Copy from `backend/.env.example` for local development.

## Project Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | FastAPI application, database, migrations |
| `frontend/` | React + TypeScript web UI |
| `services/embedding/` | Sentence-transformers service for semantic search |
| `services/linting/` | C# OPC UA linting tool |
| `services/metrics/` | C# OPC UA metrics calculator |

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
