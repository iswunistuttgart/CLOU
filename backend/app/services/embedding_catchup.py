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
import os

from sqlalchemy.orm import sessionmaker

from app.services.embeddings import count_pending_embeddings, retry_pending_embeddings


def get_catchup_runtime_config() -> tuple[int, int]:
    interval = max(int(os.getenv("EMBEDDING_CATCHUP_INTERVAL_SEC", "5")), 1)
    batch_size = max(int(os.getenv("EMBEDDING_CATCHUP_BATCH_SIZE", "50")), 1)
    return interval, batch_size


def get_import_idle_config() -> tuple[bool, int, int]:
    enabled = os.getenv("EMBEDDING_WAIT_FOR_IMPORT_IDLE", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    stable_checks = max(int(os.getenv("EMBEDDING_IMPORT_IDLE_STABLE_CHECKS", "3")), 1)
    check_interval = max(int(os.getenv("EMBEDDING_IMPORT_IDLE_CHECK_SEC", "5")), 1)
    return enabled, stable_checks, check_interval


async def wait_for_import_idle(
    *,
    session_maker: sessionmaker,
    logger: logging.Logger,
    stop_event: asyncio.Event,
    stable_checks: int,
    check_interval_seconds: int,
) -> None:
    stable_count = 0
    previous_pending = None

    logger.info(
        "Waiting for import idle: stable_checks=%s check_interval=%ss",
        stable_checks,
        check_interval_seconds,
    )

    while not stop_event.is_set():
        try:
            pending = await asyncio.to_thread(count_pending_embeddings, session_maker)
        except Exception:
            logger.exception("Failed to inspect pending embeddings while waiting for idle")
            pending = None

        if pending is not None:
            # Consider import idle once pending count stops increasing for N checks.
            if previous_pending is not None and pending <= previous_pending:
                stable_count += 1
            else:
                stable_count = 0

            logger.info(
                "Import idle probe: pending=%s previous=%s stable=%s/%s",
                pending,
                previous_pending,
                stable_count,
                stable_checks,
            )
            previous_pending = pending

            if stable_count >= stable_checks:
                logger.info("Import appears idle, starting embedding catch-up")
                return

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=check_interval_seconds)
        except asyncio.TimeoutError:
            pass


async def embedding_catchup_loop(
    *,
    session_maker: sessionmaker,
    logger: logging.Logger,
    stop_event: asyncio.Event,
    interval_seconds: int,
    batch_size: int,
) -> None:
    while not stop_event.is_set():
        try:
            processed = await asyncio.to_thread(
                retry_pending_embeddings,
                session_maker,
                batch_size,
            )
            if processed:
                logger.info("Embedding catch-up processed %s pending records", processed)
        except Exception:
            logger.exception("Embedding catch-up loop failed")
            processed = 0

        # If we filled the whole batch there is likely still backlog, so continue
        # immediately and maximize throughput during imports.
        if processed >= batch_size:
            continue

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            pass
