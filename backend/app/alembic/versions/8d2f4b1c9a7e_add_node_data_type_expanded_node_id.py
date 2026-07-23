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

"""add node data_type_expanded_node_id

Revision ID: 8d2f4b1c9a7e
Revises: f06a0379d67e
Create Date: 2026-07-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "8d2f4b1c9a7e"
down_revision = "f06a0379d67e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "node",
        sa.Column(
            "data_type_expanded_node_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("node", "data_type_expanded_node_id")
