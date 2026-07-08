# Copyright 2026 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. and Universität Stuttgart

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


from functools import lru_cache
from typing import Optional
import os
import logging
import sys
import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("embedding-service")

# Configuration from environment variables
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "Qwen/Qwen3-Embedding-0.6B")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "auto")

# Thread pool for parallel embedding generation
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
logger.info(f"Thread pool initialized with {MAX_WORKERS} workers")


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dimension: int


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    dimension: int


class EmbeddingService:
    def __init__(self, model_name: str, model_dim: int):
        # Device selection
        device_cfg = EMBEDDING_DEVICE.lower()
        cuda_available = torch.cuda.is_available()
        if device_cfg in {"auto", "cuda"}:
            if cuda_available:
                device = "cuda"
            else:
                device = "cpu"
                if device_cfg == "cuda":
                    logger.warning(
                        "EMBEDDING_DEVICE=cuda requested, but CUDA is not available. Falling back to CPU."
                    )
        else:
            device = device_cfg
        self.device = device
        
        logger.info(f"Loading embedding model '{model_name}' on device={self.device}...")
        
        self.model = SentenceTransformer(
            model_name_or_path=model_name,
            device=self.device,
            trust_remote_code=True
        )
        
        dim = self.model.get_sentence_embedding_dimension()
        if dim != model_dim:
            raise ValueError(f"Configured EMBEDDING_DIM {model_dim} != model dimension {dim}")
        
        self.model_name = model_name
        self.dimension = dim
        logger.info(f"Embedding model loaded successfully. Dimension: {dim}")
    
    def embed_one(self, text: str) -> list[float]:
        """Encode a single text into an embedding vector."""
        emb = self.model.encode(
            [text],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,  # Prevents multiprocessing overhead
            device=self.device
        )[0]
        return emb.tolist()


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Cached singleton instance of the embedding service."""
    return EmbeddingService(model_name=EMBEDDING_MODEL_NAME, model_dim=EMBEDDING_DIM)


# FastAPI app
app = FastAPI(
    title="Embedding Service",
    description="Standalone service for text embeddings",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    """Preload the embedding model on startup."""
    logger.info("Starting embedding service...")
    try:
        get_embedding_service()
        logger.info("Embedding service ready")
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        raise


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    service = get_embedding_service()
    return HealthResponse(
        status="healthy",
        model=service.model_name,
        device=service.device,
        dimension=service.dimension
    )


@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """Generate an embedding for the given text (runs in thread pool for parallelism)."""
    try:
        service = get_embedding_service()
        # Run CPU-bound embedding in thread pool to allow parallel processing
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            executor,
            service.embed_one,
            request.text
        )
        return EmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding)
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
