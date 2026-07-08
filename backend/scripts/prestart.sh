#! /usr/bin/env bash

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


set -e
set -x

reset_alembic_version_table() {
    python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
with engine.connect() as conn:
    conn.execute(text('DROP TABLE IF EXISTS public.alembic_version;'))
    conn.commit()
"
}

run_alembic_upgrade() {
    local output

    if output=$(alembic upgrade head 2>&1); then
        printf '%s\n' "$output"
        return 0
    fi

    printf '%s\n' "$output"

    if [[ "$output" == *"Can't locate revision identified by"* ]]; then
        echo "Recovering from stale Alembic revision by resetting alembic_version and stamping head..."
        reset_alembic_version_table
        alembic stamp head
        alembic upgrade head
        return 0
    fi

    return 1
}

# Let the DB start
python app/backend_pre_start.py

# Enable ParadeDB extensions
echo "Enabling ParadeDB extensions..."
python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings

print('Connecting to database...')
engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
with engine.connect() as conn:
    # Essential extensions
    conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector;'))
    print('✅ pgvector extension enabled')
    
    # Try ParadeDB search extension
    try:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS pg_search;'))
        print('✅ pg_search extension enabled')
    except Exception as e:
        print(f'⚠️  pg_search extension not available: {e}')
    
    conn.commit()
    print('✅ Available ParadeDB extensions enabled')
"

# Run migrations
run_alembic_upgrade