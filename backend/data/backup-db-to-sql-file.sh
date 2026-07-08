#!/bin/bash

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


## Creates a db-backup of the current database and saves it in data/db-backup with timestamp

# Allow execution via `sh script.sh` by re-running in bash.
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi

set -euo pipefail

# 0) Get dir of this script, then get project root as parent dir of FILEDIR
filedir="$(dirname "$(realpath $BASH_SOURCE)")"
project_root="$(dirname "$filedir")"

### SET Variables
BACKUP_DIR="$project_root/data" 
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-backend-db-1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-app}"
DUMP_MODE="${DUMP_MODE:-copy}" # copy (fast) or insert (compatible)
DISABLE_TRIGGERS="${DISABLE_TRIGGERS:-true}"
FORCE_OVERWRITE=false
filename="${BACKUP_FILE:-$BACKUP_DIR/db-backup.sql}"

usage() {
    cat <<EOF
Usage: bash data/backup-db-to-sql-file.sh [options]

Options:
  -c <container>   Docker container name (default: $POSTGRES_CONTAINER_NAME)
  -u <user>        DB user (default: $POSTGRES_USER)
  -w <password>    DB password (default: value from POSTGRES_PASSWORD)
  -d <database>    DB name (default: $POSTGRES_DB)
  -m <mode>        Dump mode: copy|insert (default: $DUMP_MODE)
    -T <true|false>  Use --disable-triggers in dump (default: $DISABLE_TRIGGERS)
  -o <file>        Output file path (default: $filename)
  -y               Overwrite existing output without prompt
  -h               Show this help

Env alternatives:
  POSTGRES_CONTAINER_NAME, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB,
    DUMP_MODE, DISABLE_TRIGGERS, BACKUP_FILE
EOF
}

while getopts ":c:u:w:d:m:T:o:yh" opt; do
    case "$opt" in
        c) POSTGRES_CONTAINER_NAME="$OPTARG" ;;
        u) POSTGRES_USER="$OPTARG" ;;
        w) POSTGRES_PASSWORD="$OPTARG" ;;
        d) POSTGRES_DB="$OPTARG" ;;
        m) DUMP_MODE="$OPTARG" ;;
                T) DISABLE_TRIGGERS="$OPTARG" ;;
        o) filename="$OPTARG" ;;
        y) FORCE_OVERWRITE=true ;;
        h)
            usage
            exit 0
            ;;
        :)
            echo "Option -$OPTARG requires an argument."
            usage
            exit 2
            ;;
        \?)
            echo "Invalid option: -$OPTARG"
            usage
            exit 2
            ;;
    esac
done

# 1) Check if the container is running
if [ ! "$(docker ps -q -f name="$POSTGRES_CONTAINER_NAME")" ]; then
    echo "Container $POSTGRES_CONTAINER_NAME is not running. Please start the DB-container or check container name in script."
    exit 1
fi

# 2) Check if the backup directory exists, if not create it
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Backup directory $BACKUP_DIR does not exist. Creating it now."
    mkdir -p "$BACKUP_DIR"
fi

# 3) Check if the backup file already exists
if [ -f "$filename" ]; then
    if [ "$FORCE_OVERWRITE" = true ]; then
        echo "Overwriting existing backup."
    else
        read -p "Backup file $filename already exists. Overwrite? (y/n) or enter new name: " choice
        case "$choice" in
            y|Y )
                echo "Overwriting existing backup."
                ;;
            n|N )
                read -p "Enter new backup filename (without path): " new_filename
                filename="$BACKUP_DIR/$new_filename.sql"
                ;;
            * )
                filename="$BACKUP_DIR/$choice.sql"
                ;;
        esac
    fi
fi

# 4) Save DB backup
base_dump_args=(
    --data-only
    --no-owner
    --no-privileges
    --exclude-table-data=public.alembic_version
    -U "$POSTGRES_USER"
    -d "$POSTGRES_DB"
)

if [ "$DISABLE_TRIGGERS" = "true" ]; then
    base_dump_args+=(--disable-triggers)
elif [ "$DISABLE_TRIGGERS" != "false" ]; then
    echo "Invalid DISABLE_TRIGGERS '$DISABLE_TRIGGERS'. Allowed values: true, false"
    exit 1
fi

if [ "$DUMP_MODE" = "insert" ]; then
    # INSERT mode is slower, but can be useful for manual inspection/import tools.
    dump_args=(
        "${base_dump_args[@]}"
        --inserts
        --on-conflict-do-nothing
    )
elif [ "$DUMP_MODE" = "copy" ]; then
    # COPY mode is the fastest option for PostgreSQL-to-PostgreSQL transfer.
    dump_args=("${base_dump_args[@]}")
else
    echo "Invalid DUMP_MODE '$DUMP_MODE'. Allowed values: copy, insert"
    exit 1
fi

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$POSTGRES_CONTAINER_NAME" pg_dump "${dump_args[@]}" > "$filename"

# 5) Make backup file readable
chmod 644 "$filename"

# 6) Print success message
echo "DB data-only backup saved to $filename (mode: $DUMP_MODE, disable_triggers: $DISABLE_TRIGGERS)"
