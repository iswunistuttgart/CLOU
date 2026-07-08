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
import threading
import httpx
from sqlalchemy import and_, or_, text, func
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

from app.core.config import settings
from app.models import Node, Spec

emb_logger = logging.getLogger("embeddings")

# Limit concurrent embedding HTTP calls per backend process to avoid request pileups
# when many nodes are created in a burst.
EMBEDDING_MAX_INFLIGHT = int(os.getenv("EMBEDDING_MAX_INFLIGHT", "2"))
_embedding_gate = threading.BoundedSemaphore(value=EMBEDDING_MAX_INFLIGHT)


class EmbeddingService:
    """HTTP client for the embedding service."""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        # Embedding generation can be slow on cold starts / CPU, so use a longer read timeout.
        self.client = httpx.Client(timeout=httpx.Timeout(90.0, connect=5.0))
        emb_logger.info(f"Embedding service client initialized: {self.base_url}")
    
    def embed_one(self, text: Optional[str]) -> Optional[list[float]]:
        """Generate embedding by calling the remote embedding service."""
        if text is None:
            return None

        # Block until a slot is free so embeddings are throttled but never skipped.
        _embedding_gate.acquire()
        
        try:
            response = self.client.post(
                f"{self.base_url}/embed",
                json={"text": text}
            )
            response.raise_for_status()
            data = response.json()
            return data["embedding"]
        except httpx.HTTPError as e:
            emb_logger.error(f"Error calling embedding service: {e}")
            raise
        finally:
            _embedding_gate.release()


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Get cached instance of embedding service client."""
    embedding_service_url = settings.EMBEDDING_SERVICE_URL
    return EmbeddingService(base_url=embedding_service_url)



def embed_node_fields(node_id: int, session_maker: sessionmaker):
    embedder = get_embedding_service()
    with session_maker() as session:
        node: Node = session.get(Node, node_id)
        if not node:
            return
        display_name_text = node.display_name if node.display_name_vector is None else None
        definition_text = node.definition if node.definition_vector is None else None
        description_text = node.description if node.description_vector is None else None

    display_name_vector = None
    definition_vector = None
    description_vector = None

    if display_name_text:
        try:
            display_name_vector = embedder.embed_one(display_name_text)
        except httpx.HTTPError as e:
            emb_logger.error(f"Failed embedding node.display_name for node_id={node_id}: {e}")

    if definition_text:
        try:
            definition_vector = embedder.embed_one(definition_text)
        except httpx.HTTPError as e:
            emb_logger.error(f"Failed embedding node.definition for node_id={node_id}: {e}")

    if description_text:
        try:
            description_vector = embedder.embed_one(description_text)
        except httpx.HTTPError as e:
            emb_logger.error(f"Failed embedding node.description for node_id={node_id}: {e}")

    if display_name_vector is None and definition_vector is None and description_vector is None:
        return

    with session_maker() as session:
        node: Node = session.get(Node, node_id)
        if not node:
            return

        changed = False
        if display_name_vector is not None and node.display_name_vector is None:
            node.display_name_vector = display_name_vector
            changed = True
        if definition_vector is not None and node.definition_vector is None:
            node.definition_vector = definition_vector
            changed = True
        if description_vector is not None and node.description_vector is None:
            node.description_vector = description_vector
            changed = True

        if changed:
            session.add(node)
            session.commit()


def embed_spec_fields(spec_id: int, session_maker: sessionmaker):
    embedder = get_embedding_service()
    with session_maker() as session:
        spec: Spec = session.get(Spec, spec_id)
        if not spec:
            return
        summary_text = spec.summary if spec.summary_vector is None else None

    if not summary_text:
        return

    try:
        summary_vector = embedder.embed_one(summary_text)
    except httpx.HTTPError as e:
        emb_logger.error(f"Failed embedding spec.summary for spec_id={spec_id}: {e}")
        return

    if summary_vector is None:
        return

    with session_maker() as session:
        spec: Spec = session.get(Spec, spec_id)
        if not spec:
            return
        if spec.summary_vector is None:
            spec.summary_vector = summary_vector
            session.add(spec)
            session.commit()


def retry_pending_embeddings(session_maker: sessionmaker, batch_size: int = 50) -> int:
    """Catch up missing embeddings so failed/time-delayed jobs are processed later."""
    processed = 0
    lock_key = 938104

    # Hold the advisory lock for the whole catch-up run so workers don't process
    # the same pending rows in parallel.
    with session_maker() as lock_session:
        got_lock = lock_session.connection().execute(
            text("SELECT pg_try_advisory_lock(:k)"),
            {"k": lock_key},
        ).scalar()
        if not got_lock:
            return 0

        try:
            pending_nodes = lock_session.exec(
                select(Node)
                .where(
                    or_(
                        and_(Node.display_name.is_not(None), Node.display_name_vector.is_(None)),
                        and_(Node.definition.is_not(None), Node.definition_vector.is_(None)),
                        and_(Node.description.is_not(None), Node.description_vector.is_(None)),
                    )
                )
                .limit(batch_size)
            ).all()

            for node in pending_nodes:
                embed_node_fields(node.id, session_maker)
                processed += 1

            remaining = max(batch_size - processed, 0)
            if remaining > 0:
                pending_specs = lock_session.exec(
                    select(Spec)
                    .where(and_(Spec.summary.is_not(None), Spec.summary_vector.is_(None)))
                    .limit(remaining)
                ).all()

                for spec in pending_specs:
                    embed_spec_fields(spec.id, session_maker)
                    processed += 1
        finally:
            lock_session.connection().execute(
                text("SELECT pg_advisory_unlock(:k)"),
                {"k": lock_key},
            )

    return processed


def count_pending_embeddings(session_maker: sessionmaker) -> int:
    """Return total number of records still missing embeddings."""
    with session_maker() as session:
        pending_nodes = session.exec(
            select(func.count(Node.id)).where(
                or_(
                    and_(Node.display_name.is_not(None), Node.display_name_vector.is_(None)),
                    and_(Node.definition.is_not(None), Node.definition_vector.is_(None)),
                    and_(Node.description.is_not(None), Node.description_vector.is_(None)),
                )
            )
        ).one()

        pending_specs = session.exec(
            select(func.count(Spec.id)).where(
                and_(Spec.summary.is_not(None), Spec.summary_vector.is_(None))
            )
        ).one()

    return int(pending_nodes or 0) + int(pending_specs or 0)



