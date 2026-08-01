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
import subprocess
import logging
import shutil
import zipfile
from pathlib import Path
from sqlalchemy import text
from alembic.config import Config
from alembic.script import ScriptDirectory

from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.models import NodeClass, NodeClassEnum, ModellingRule, ModellingRuleEnum

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_CONFIG_PATH = PROJECT_ROOT / "alembic.ini"
DATABASE_INIT_LOCK_ID = 20260706

REQUIRED_SEEDED_TABLES = (
    "nodeset",
    "spec",
    "modelling_rule",
    "node_class",
    "node",
    "nodeset_required_link",
    "spec_nodeset_link",
)


def _get_incomplete_seed_tables() -> list[str]:
    incomplete_tables: list[str] = []

    with engine.connect() as conn:
        for table_name in REQUIRED_SEEDED_TABLES:
            table_exists = conn.execute(
                text(f"SELECT to_regclass('public.{table_name}') IS NOT NULL")
            ).scalar()
            if not table_exists:
                incomplete_tables.append(table_name)
                continue

            table_count = conn.execute(text(f"SELECT COUNT(*) FROM public.{table_name}"))
            if not table_count.scalar():
                incomplete_tables.append(table_name)

    return incomplete_tables

def _truncate_seed_tables(logger: logging.Logger) -> None:
    existing_tables = []
    with engine.connect() as conn:
        for table_name in REQUIRED_SEEDED_TABLES:
            exists = conn.execute(
                text(f"SELECT to_regclass('public.{table_name}') IS NOT NULL")
            ).scalar()
            if exists:
                existing_tables.append(table_name)

        if existing_tables:
            conn.execute(
                text(
                    "TRUNCATE TABLE "
                    + ", ".join(f"public.{t}" for t in existing_tables)
                    + " RESTART IDENTITY CASCADE;"
                )
            )
            conn.commit()
    logger.info("Seed-Tabellen vor Restore geleert: %s", ", ".join(existing_tables))


def _database_already_seeded() -> bool:
    return not _get_incomplete_seed_tables()


def _get_current_alembic_head() -> str:
    alembic_config = Config(str(ALEMBIC_CONFIG_PATH))
    script_directory = ScriptDirectory.from_config(alembic_config)
    head = script_directory.get_current_head()
    if head is None:
        raise RuntimeError("Alembic head revision could not be determined.")
    return head


def _stamp_alembic_version_table(logger: logging.Logger) -> None:
    current_head = _get_current_alembic_head()

    with engine.connect() as conn:
        alembic_table_exists = conn.execute(
            text("SELECT to_regclass('public.alembic_version') IS NOT NULL")
        ).scalar()

        if not alembic_table_exists:
            conn.execute(
                text(
                    """
                    CREATE TABLE public.alembic_version (
                        version_num VARCHAR(32) NOT NULL PRIMARY KEY
                    )
                    """
                )
            )
        else:
            conn.execute(text("DELETE FROM public.alembic_version"))

        conn.execute(
            text(
                "INSERT INTO public.alembic_version (version_num) VALUES (:version_num)"
            ),
            {"version_num": current_head},
        )
        conn.commit()

    logger.info(
        "Alembic version table stamped to current head after SQL restore: %s",
        current_head,
    )


def initialize_database(
    sql_file_path: str, logger=logging.getLogger("app.db")
) -> str:
    with engine.connect() as conn:
        logger.info("Waiting for database initialization lock...")
        conn.execute(
            text("SELECT pg_advisory_lock(:lock_id)"),
            {"lock_id": DATABASE_INIT_LOCK_ID},
        )

        try:
            restore_status = load_sql_backup(sql_file_path=sql_file_path, logger=logger)
            if restore_status == "restored":
                _stamp_alembic_version_table(logger=logger)
                return "restored"

            if restore_status == "missing":
                create_initial_values()
                return "seeded"

            return "already_seeded"
        finally:
            conn.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": DATABASE_INIT_LOCK_ID},
            )
            conn.commit()


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def create_initial_values() -> None:
    with Session(engine) as session:

        # Seed rows are inserted only when the exact key is missing.
        node_class_seed = {
            1: NodeClassEnum.object.value,
            2: NodeClassEnum.object_type.value,
            3: NodeClassEnum.variable.value,
            4: NodeClassEnum.variable_type.value,
            5: NodeClassEnum.method.value,
            6: NodeClassEnum.data_type.value
        }
        for node_class_id, node_class_value in node_class_seed.items():
            if session.get(NodeClass, node_class_id) is None:
                session.add(NodeClass(id=node_class_id, node_class=node_class_value))

        modelling_rules_seed = {
            78: ModellingRuleEnum.mandatory.value,
            80: ModellingRuleEnum.optional.value,
            11510: ModellingRuleEnum.mandatory_placeholder.value,
            11508: ModellingRuleEnum.optional_placeholder.value,
            83: ModellingRuleEnum.exposes_its_array.value
        }
        for rule_id, rule_value in modelling_rules_seed.items():
            if session.get(ModellingRule, rule_id) is None:
                session.add(ModellingRule(id=rule_id, rule=rule_value))

        session.commit()


def load_sql_backup(
    sql_file_path: str, logger=logging.getLogger("app.db")
) -> str:
    """
    Load and execute an SQL script from the given file path using psql.

    Is used during startup to load a SQL backup file into the database.

    Args:
        sql_file_path (str): The path to the SQL file to be executed.
        logger (logging.Logger): Logger instance for logging messages. Defaults to the 'app.db' logger.

    Returns:
        str: One of "restored", "missing", or "already_seeded".

    Raises:
        FileNotFoundError: If psql or docker/podman is missing.
        RuntimeError: If psql returns a non-zero exit code.
    """

    zip_file_path = sql_file_path
    sql_file_name_in_zip = "db-backup.sql"


    if not os.path.isfile(zip_file_path):
        logger.info(
            "SQL backup restore skipped because backup ZIP file is missing at %s.",
            zip_file_path,
        )
        return "missing"

    if _database_already_seeded():
        logger.info(
            "SQL backup restore skipped because database already contains seed data."
        )
        return "already_seeded"

    incomplete_tables = _get_incomplete_seed_tables()
    if incomplete_tables:
        logger.info(
            "SQL backup restore required because these tables are missing or empty: %s",
            ", ".join(incomplete_tables),
        )

    logger.info(f"Attempting to load SQL backup %s from ZIP file %s...", sql_file_name_in_zip, zip_file_path)

    _truncate_seed_tables(logger=logger)

    # Prepare environment variables for psql, especially PGPASSWORD
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

    try:
        with zipfile.ZipFile(zip_file_path, "r") as backup_zip:
            if sql_file_name_in_zip not in backup_zip.namelist():
                raise FileNotFoundError(
                    f"{sql_file_name_in_zip} was not found inside {zip_file_path}."
                )

            with backup_zip.open(sql_file_name_in_zip, "r") as sql_file:
                sql_script = sql_file.read().decode("utf-8")

        psql_binary = shutil.which("psql")

        if psql_binary:
            logger.info("Using local psql executable for SQL backup restore.")

            psql_command = [
                psql_binary,
                "-h", settings.POSTGRES_SERVER,
                "-U", settings.POSTGRES_USER,
                "-d", settings.POSTGRES_DB,
                "-v", "ON_ERROR_STOP=1",
                "--single-transaction",
                "--quiet",
            ]

            if settings.POSTGRES_PORT:
                psql_command.extend(["-p", str(settings.POSTGRES_PORT)])

            result = subprocess.run(
                psql_command,
                input=sql_script,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )

        else:
            compose_binary = shutil.which("docker") or shutil.which("podman")
            if not compose_binary:
                raise FileNotFoundError(
                    "Neither local psql nor docker/podman is available for SQL backup restore."
                )

            logger.info(
                "Local psql not found. Using %s compose exec db psql for SQL backup restore.",
                Path(compose_binary).name,
            )

            compose_command = [
                compose_binary,
                "compose",
                "-f", str(PROJECT_ROOT / "docker-compose.yml"),
                "exec",
                "-T",
                "db",
                "psql",
                "-U", settings.POSTGRES_USER,
                "-d", settings.POSTGRES_DB,
                "-v", "ON_ERROR_STOP=1",
                "--single-transaction",
                "--quiet",
            ]

            result = subprocess.run(
                compose_command,
                cwd=str(PROJECT_ROOT),
                env=env,
                input=sql_script,
                check=True,
                capture_output=True,
                text=True,
            )

        logger.info("SQL backup loaded successfully using psql.")

        if result.stdout:
            logger.debug("psql stdout:\n%s", result.stdout)

        if result.stderr:
            logger.info("psql stderr:\n%s", result.stderr)

        return "restored"

    except subprocess.CalledProcessError as e:
        logger.error("Error loading SQL backup using psql. Return code: %s", e.returncode)

        if e.stdout:
            logger.error("psql stdout:\n%s", e.stdout)

        if e.stderr:
            logger.error("psql stderr:\n%s", e.stderr)

        raise RuntimeError("SQL backup restore failed") from e

    except FileNotFoundError:
        logger.error("Required SQL backup ZIP file, SQL file inside ZIP, or psql executable was not found.")
        raise

    except zipfile.BadZipFile as e:
        logger.error("SQL backup ZIP file is invalid or corrupted: %s", zip_file_path)
        raise RuntimeError("SQL backup ZIP file is invalid or corrupted") from e

    except Exception as e:
        logger.error("An unexpected error occurred during SQL backup: %s", e)
        raise


def ensure_node_search_db_artifacts(logger=logging.getLogger("app.db")) -> None:
    """Ensure node search extensions and indexes exist, independent of Alembic history."""
    with engine.connect() as conn:
        logger.info("Waiting for node-search artifacts lock...")
        conn.execute(
            text("SELECT pg_advisory_lock(:lock_id)"),
            {"lock_id": DATABASE_INIT_LOCK_ID},
        )
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))

            node_table_exists = conn.execute(
                text("SELECT to_regclass('public.node') IS NOT NULL")
            ).scalar()

            if not node_table_exists:
                logger.warning("Node table not found; skipping node search index creation.")
                conn.commit()
                return

            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_node_nodeset_id ON node (nodeset_id);")
            )
            conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_node_display_name_lower_trgm
                    ON node
                    USING gin (lower(display_name) gin_trgm_ops);
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_node_definition_vector_ivfflat
                    ON node
                    USING ivfflat (definition_vector vector_cosine_ops)
                    WITH (lists = 100)
                    WHERE definition_vector IS NOT NULL;
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_node_description_vector_ivfflat
                    ON node
                    USING ivfflat (description_vector vector_cosine_ops)
                    WITH (lists = 100)
                    WHERE description_vector IS NOT NULL;
                    """
                )
            )
            display_name_vector_exists = conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = 'node'
                        AND column_name = 'display_name_vector'
                    );
                    """
                )
            ).scalar()
            if display_name_vector_exists:
                conn.execute(
                    text(
                        """
                        CREATE INDEX IF NOT EXISTS ix_node_display_name_vector_ivfflat
                        ON node
                        USING ivfflat (display_name_vector vector_cosine_ops)
                        WITH (lists = 100)
                        WHERE display_name_vector IS NOT NULL;
                        """
                    )
                )
            conn.commit()
            logger.info("Node search DB artifacts ensured (extensions + indexes).")
        finally:
            conn.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": DATABASE_INIT_LOCK_ID},
            )
            conn.commit()