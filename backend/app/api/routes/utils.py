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


from fastapi import APIRouter
from sqlmodel import Session
from sqlalchemy.orm import sessionmaker

from app.core.db import engine
from app.services.embeddings import retry_pending_embeddings

router = APIRouter(prefix="/utils", tags=["utils"])


@router.get("/health-check/")
async def health_check() -> bool:
    return True


@router.post("/embeddings/catchup")
def run_embedding_catchup(rounds: int = 20, batch_size: int = 50) -> dict[str, int]:
    """Manually process pending embeddings, e.g. after a bulk import has finished."""
    if rounds < 1:
        rounds = 1
    if batch_size < 1:
        batch_size = 1

    session_maker = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    total_processed = 0
    executed_rounds = 0

    for _ in range(rounds):
        executed_rounds += 1
        processed = retry_pending_embeddings(session_maker, batch_size)
        total_processed += processed
        if processed == 0:
            break

    return {
        "processed": total_processed,
        "rounds": executed_rounds,
    }
