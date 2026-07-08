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


"""squashed baseline schema

Revision ID: ccc1edb89e81
Revises:
Create Date: 2026-06-05 14:03:03.311527

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
import pgvector
import app


# revision identifiers, used by Alembic.
revision = 'ccc1edb89e81'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")

    op.create_table(
        'modelling_rule',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule', sa.Enum('mandatory', 'optional', 'mandatory_placeholder', 'optional_placeholder', name='modellingruleenum'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rule'),
    )
    op.create_table(
        'node_type',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('node_type', sa.Enum('variable', 'variable_type', 'object', 'object_type', name='nodetypeenum'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('node_type'),
    )
    op.create_table(
        'nodeset',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('uri', app.models.UriType(length=2083), nullable=False),
        sa.Column('name_short', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('version', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('publication_date', sa.DateTime(), nullable=False),
        sa.Column('download_url', app.models.UriType(length=2083), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uri', 'version', name='unique_nodeset_uri_version'),
    )
    op.create_table(
        'spec',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('number', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name_long', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name_short', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('version', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('release_date', sa.Date(), nullable=False),
        sa.Column('summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('summary_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('download_url', app.models.UriType(length=2083), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('number', 'version', name='unique_spec_number_version'),
    )
    op.create_table(
        'unit',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('unece_code', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('unece_code'),
    )
    op.create_table(
        'data_type',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expanded_node_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_name_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('definition', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('definition_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('description_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('documentation', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('is_abstract', sa.Boolean(), nullable=False),
        sa.Column('spec_id', sa.Integer(), nullable=False),
        sa.Column('nodeset_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['nodeset_id'], ['nodeset.id']),
        sa.ForeignKeyConstraint(['spec_id'], ['spec.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('expanded_node_id', 'nodeset_id', name='unique_datatype_expnodeid_nodeset'),
    )
    op.create_table(
        'nodeset_required_link',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('nodeset_id', sa.Integer(), nullable=False),
        sa.Column('required_nodeset_id', sa.Integer(), nullable=False),
        sa.Column('is_correct_version', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['nodeset_id'], ['nodeset.id']),
        sa.ForeignKeyConstraint(['required_nodeset_id'], ['nodeset.id']),
        sa.PrimaryKeyConstraint('nodeset_id', 'required_nodeset_id'),
    )
    op.create_table(
        'spec_nodeset_link',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('spec_id', sa.Integer(), nullable=False),
        sa.Column('nodeset_id', sa.Integer(), nullable=False),
        sa.Column('is_correct_version', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['nodeset_id'], ['nodeset.id']),
        sa.ForeignKeyConstraint(['spec_id'], ['spec.id']),
        sa.PrimaryKeyConstraint('spec_id', 'nodeset_id'),
    )
    op.create_table(
        'node',
        sa.Column('create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('update_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expanded_node_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_name_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('definition', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('definition_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('description_vector', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column('documentation', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('node_type_id', sa.Integer(), nullable=False),
        sa.Column('spec_id', sa.Integer(), nullable=True),
        sa.Column('nodeset_id', sa.Integer(), nullable=False),
        sa.Column('typedefinition_id', sa.Integer(), nullable=True),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('example_id', sa.Integer(), nullable=True),
        sa.Column('data_type_id', sa.Integer(), nullable=True),
        sa.Column('unit_id', sa.Integer(), nullable=True),
        sa.Column('modelling_rule_id', sa.Integer(), nullable=True),
        sa.Column('naming_example', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_abstract', sa.Boolean(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['data_type_id'], ['data_type.id']),
        sa.ForeignKeyConstraint(['example_id'], ['nodeset.id']),
        sa.ForeignKeyConstraint(['modelling_rule_id'], ['modelling_rule.id']),
        sa.ForeignKeyConstraint(['node_type_id'], ['node_type.id']),
        sa.ForeignKeyConstraint(['nodeset_id'], ['nodeset.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['node.id']),
        sa.ForeignKeyConstraint(['spec_id'], ['spec.id']),
        sa.ForeignKeyConstraint(['typedefinition_id'], ['node.id']),
        sa.ForeignKeyConstraint(['unit_id'], ['unit.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index(
        'ix_node_bm25',
        'node',
        ['id', 'display_name', 'definition', 'description', 'documentation'],
        unique=False,
        postgresql_using='bm25',
        postgresql_with={'key_field': 'id'},
    )
    op.create_index('ix_node_nodeset_id', 'node', ['nodeset_id'], unique=False)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_node_display_name_vector_ivfflat
        ON node
        USING ivfflat (display_name_vector vector_cosine_ops)
        WITH (lists = 100)
        WHERE display_name_vector IS NOT NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_node_definition_vector_ivfflat
        ON node
        USING ivfflat (definition_vector vector_cosine_ops)
        WITH (lists = 100)
        WHERE definition_vector IS NOT NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_node_description_vector_ivfflat
        ON node
        USING ivfflat (description_vector vector_cosine_ops)
        WITH (lists = 100)
        WHERE description_vector IS NOT NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_node_display_name_lower_trgm
        ON node
        USING gin (lower(display_name) gin_trgm_ops);
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_node_display_name_lower_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_node_description_vector_ivfflat;")
    op.execute("DROP INDEX IF EXISTS ix_node_definition_vector_ivfflat;")
    op.execute("DROP INDEX IF EXISTS ix_node_display_name_vector_ivfflat;")
    op.drop_index('ix_node_nodeset_id', table_name='node')
    op.drop_index('ix_node_bm25', table_name='node', postgresql_using='bm25', postgresql_with={'key_field': 'id'})
    op.drop_table('node')
    op.drop_table('spec_nodeset_link')
    op.drop_table('nodeset_required_link')
    op.drop_table('data_type')
    op.drop_table('unit')
    op.drop_table('spec')
    op.drop_table('nodeset')
    op.drop_table('node_type')
    op.drop_table('modelling_rule')