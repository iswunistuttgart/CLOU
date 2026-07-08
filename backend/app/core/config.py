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


import os
from typing import Annotated, Any, Literal

from pydantic import (
    AnyUrl,
    BeforeValidator,
    PostgresDsn,
    computed_field,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    
    # Embedding service configuration
    EMBEDDING_SERVICE_URL: str = "http://embedding-service:8000"
    EMBEDDING_MODEL_NAME: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_DIM: int = 1024
    EMBEDDING_DEVICE: str = os.getenv("EMBEDDING_DEVICE", "auto")
    EMBEDDING_ON_WRITE: bool = False
    EMBEDDING_PERIODIC_CATCHUP_ENABLED: bool = False
    EMBEDDING_CATCHUP_RUN_IN_API: bool = False

    # Node semantic search tuning
    NODE_SEARCH_LIMIT_DEFAULT: int = 10
    NODE_SEARCH_LIMIT_MAX: int = 50
    NODE_SEARCH_RRF_K_DEFAULT: int = 60
    NODE_SEARCH_RRF_K_MIN: int = 1
    NODE_SEARCH_RRF_K_MAX: int = 1000
    NODE_SEARCH_LEX_MULTIPLIER: int = 10
    NODE_SEARCH_DENSE_MULTIPLIER: int = 10
    NODE_SEARCH_WEIGHT_LEXICAL: float = 1.0
    NODE_SEARCH_WEIGHT_DENSE: float = 1.4
    NODE_SEARCH_WEIGHT_TRIGRAM: float = 0.8
    NODE_SEARCH_TRIGRAM_MULTIPLIER: int = 10
    NODE_SEARCH_TRIGRAM_THRESHOLD: float = 0.2
    NODE_SEARCH_HIGH_TRIGRAM_THRESHOLD: float = 0.85
    NODE_SEARCH_ENABLE_TRIGRAM_FALLBACK: bool = True
    NODE_SEARCH_ENABLE_DENSE_FALLBACK: bool = True
    NODE_SEARCH_ENSURE_DB_ARTIFACTS_ON_STARTUP: bool = True
    NODE_SEARCH_EXACT_NAME_BONUS: float = 1.0
    NODE_SEARCH_HIGH_TRIGRAM_BONUS: float = 0.2
    NODE_SEARCH_DISPLAY_NAME_SIMILARITY_BONUS: float = 1.0

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return MultiHostUrl.build(
            scheme="postgresql+pg8000",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

settings = Settings()  # type: ignore
