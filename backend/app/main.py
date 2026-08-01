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


import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import logging, sys
from contextlib import asynccontextmanager
import asyncio
from pathlib import Path

from app.api.main import api_router
from app.core.config import settings
from app.core.db import ensure_node_search_db_artifacts, initialize_database, engine
from app.services.embedding_catchup import (
    embedding_catchup_loop,
    get_catchup_runtime_config,
)
from sqlmodel import Session
from sqlalchemy.orm import sessionmaker


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


logging.basicConfig(
    level=logging.INFO,  # so INFO isn't dropped
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],  # stdout -> docker logs
)

logger = logging.getLogger("app")
logger.info("Logger initialized")


def _truncate_for_log(value, max_len: int = 200):
    if isinstance(value, str):
        if len(value) > max_len:
            return f"{value[:max_len]}...<truncated>"
        return value

    if isinstance(value, list):
        return [_truncate_for_log(item, max_len=max_len) for item in value]

    if isinstance(value, tuple):
        return tuple(_truncate_for_log(item, max_len=max_len) for item in value)

    if isinstance(value, dict):
        truncated = {}
        for key, item in value.items():
            if key == "input":
                item_str = str(item)
                if len(item_str) > max_len:
                    truncated[key] = f"{item_str[:max_len]}...<truncated>"
                else:
                    truncated[key] = item
                continue

            truncated[key] = _truncate_for_log(item, max_len=max_len)
        return truncated

    return value


def get_sql_backup_path() -> str:
    local_backup_path = Path("data/db-backup.zip")
    if local_backup_path.is_file():
        return str(local_backup_path)
    return "/backups/db-backup.sql"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # app startup
    logger.info("Startup: init database...")
    # DB init
    try:
        init_result = initialize_database(
            sql_file_path=get_sql_backup_path(),
            logger=logger,
        )

        if init_result == "restored":
            logger.info("Database initialized from backup.")
        elif init_result == "seeded":
            logger.info("Database initialized from application seed data.")
        else:
            logger.info("Database initialization skipped because data already exists.")

        if settings.NODE_SEARCH_ENSURE_DB_ARTIFACTS_ON_STARTUP:
            ensure_node_search_db_artifacts(logger=logger)
    except Exception as e:
        logger.exception("Startup DB init failed: %s", e)
        raise

    logger.info("Backend ready (embedding service is separate)")

    catchup_interval_sec, catchup_batch_size = get_catchup_runtime_config()
    stop_event = None
    catchup_task = None

    if settings.EMBEDDING_PERIODIC_CATCHUP_ENABLED and settings.EMBEDDING_CATCHUP_RUN_IN_API:
        logger.info(
            "Embedding catch-up loop configured: interval=%ss batch_size=%s",
            catchup_interval_sec,
            catchup_batch_size,
        )
        SessionMaker = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
        stop_event = asyncio.Event()

        catchup_task = asyncio.create_task(
            embedding_catchup_loop(
                session_maker=SessionMaker,
                logger=logger,
                stop_event=stop_event,
                interval_seconds=catchup_interval_sec,
                batch_size=catchup_batch_size,
            )
        )

    yield
    if stop_event is not None:
        stop_event.set()
    if catchup_task is not None:
        await catchup_task
    logger.info("Shutdown")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    body_preview = "<unavailable>"
    try:
        raw_body = await request.body()
        body_preview = raw_body.decode("utf-8", errors="replace")
    except Exception:
        pass

    max_preview_len = 50
    if len(body_preview) > max_preview_len:
        body_preview = f"{body_preview[:max_preview_len]}...<truncated>"

    log_errors = _truncate_for_log(exc.errors(), max_len=50)

    logger.warning(
        "422 validation error on %s %s errors=%s body=%s",
        request.method,
        request.url.path,
        log_errors,
        body_preview,
    )

    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.get("/api/v1/utils/health-check/", tags=["utils"])
def health_check():
    return {"status": "healthy"}


# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
