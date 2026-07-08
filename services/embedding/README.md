# CLOU Embedding Service

Standalone FastAPI service for generating text embeddings using sentence-transformers.

## Purpose

Provides semantic search capabilities by generating vector embeddings stored in ParadeDB.

> **For running CLOU**: See [README.md](../../README.md) - only Docker is required.

## Development

### Requirements

- [uv](https://docs.astral.sh/uv/) for Python package management

### Local Development

```bash
cd services/embedding
uv sync
uv run python main.py
```

Runs internally on port 8000 (not exposed to host by default in Docker Compose).

## Docker

### CPU Version (Default)

```bash
docker build -t embedding-service:latest_cpu services/embedding
docker run -p 8000:8000 embedding-service:latest_cpu
```

### GPU Version

Requires NVIDIA GPU + nvidia-docker.

```bash
docker build -t embedding-service:latest_gpu services/embedding \
  --build-arg TORCH_INDEX_URL=https://download.pytorch.org/whl/cu124
docker run --gpus all -p 8000:8000 embedding-service:latest_gpu
```

Note: GPU version requires significantly more memory tha CPU version.

### Full Stack

```bash
# CPU
docker compose up --build

# GPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL_NAME` | `Qwen/Qwen3-Embedding-0.6B` | Hugging Face model |
| `EMBEDDING_DIM` | `1024` | Embedding dimension |
| `EMBEDDING_DEVICE` | `auto` | cpu/cuda/auto |

## API

- `POST /embed` - Generate embeddings
- `GET /health` - Health check

## License

Licensed under the Apache License 2.0. See [LICENSE](../../LICENSE) file for details.