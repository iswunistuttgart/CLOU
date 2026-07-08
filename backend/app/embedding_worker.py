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


import asyncio
import logging
import signal
import sys

from sqlalchemy.orm import sessionmaker
from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine
from app.services.embedding_catchup import (
    embedding_catchup_loop,
    get_catchup_runtime_config,
    get_import_idle_config,
    wait_for_import_idle,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("embedding-worker")


async def run_worker() -> None:
    if not settings.EMBEDDING_PERIODIC_CATCHUP_ENABLED:
        logger.info("Embedding worker disabled via EMBEDDING_PERIODIC_CATCHUP_ENABLED=false")
        return

    interval_seconds, batch_size = get_catchup_runtime_config()
    wait_for_idle, stable_checks, idle_check_interval = get_import_idle_config()
    logger.info(
        "Embedding worker started: interval=%ss batch_size=%s",
        interval_seconds,
        batch_size,
    )

    session_maker = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    if wait_for_idle:
        await wait_for_import_idle(
            session_maker=session_maker,
            logger=logger,
            stop_event=stop_event,
            stable_checks=stable_checks,
            check_interval_seconds=idle_check_interval,
        )

    if stop_event.is_set():
        logger.info("Worker stopped before catch-up loop start")
        return

    await embedding_catchup_loop(
        session_maker=session_maker,
        logger=logger,
        stop_event=stop_event,
        interval_seconds=interval_seconds,
        batch_size=batch_size,
    )

    logger.info("Embedding worker stopped")


if __name__ == "__main__":
    asyncio.run(run_worker())
