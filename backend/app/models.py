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


from datetime import datetime, date
from enum import Enum
from typing import Optional

from pydantic import AnyHttpUrl
from sqlalchemy import TypeDecorator, String, Dialect, DateTime, func, UniqueConstraint, Index
from sqlalchemy.sql.type_api import _T
from sqlmodel import Field, Relationship, SQLModel
from pgvector.sqlalchemy import Vector

from app.core.config import settings


##### Shared Classes #####
class UriType(TypeDecorator):
    impl = String(2083)
    cache_ok = True
    python_type = AnyHttpUrl

    def process_bind_param(self, value: Optional[_T], dialect: Dialect) -> str:
        return str(value)

    def process_result_value(
            self, value, dialect) -> AnyHttpUrl:
        return AnyHttpUrl(url=value)

    def process_literal_param(
            self, value, dialect) -> str:
        return str(value)


class Times(SQLModel, table=False):
    create_time: datetime | None = Field(default=None, sa_type=DateTime(timezone=True), sa_column_kwargs={"default": func.now()})
    update_time: datetime | None = Field(default=None, sa_type=DateTime(timezone=True), sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})
    # todo: check bei updates, ob sich create nicht ändert und update ändert!


class NodeBaseAttr(SQLModel, table=False):
    expanded_node_id: str = Field(unique=True)
    display_name: str
    display_name_vector: list[float] | None = Field(
        sa_type=Vector(dim=settings.EMBEDDING_DIM), default=None
    )
    definition: str | None
    definition_vector: list[float] | None = Field(
        sa_type=Vector(dim=settings.EMBEDDING_DIM), default=None
    )
    description: str | None
    description_vector: list[float] | None = Field(
        sa_type=Vector(dim=settings.EMBEDDING_DIM), default=None
    )
    documentation: str | None

class SpecNodesetLinkBase(SQLModel, table=False):
    spec_id: int = Field(foreign_key="spec.id", primary_key=True)
    nodeset_id: int = Field(foreign_key="nodeset.id", primary_key=True)
    is_correct_version: bool

class SpecNodesetLink(SpecNodesetLinkBase, Times, table=True):
    __tablename__: str = "spec_nodeset_link"

class SpecNodesetLinkCreate(SpecNodesetLinkBase, table=False):
    pass

class SpecNodesetLinkPublic(SpecNodesetLinkBase, Times, table=False):
    pass

class NodesetRequiredBase(SQLModel, table=False):
    nodeset_id: int = Field(foreign_key="nodeset.id", primary_key=True)
    required_nodeset_id: int = Field(foreign_key="nodeset.id", primary_key=True)
    is_correct_version: bool

class NodesetRequiredLink(NodesetRequiredBase, Times, table=True):
    __tablename__: str = "nodeset_required_link"

class NodesetRequiredLinkCreate(NodesetRequiredBase, table=False):
    pass

class NodesetRequiredLinkPublic(NodesetRequiredBase, Times, table=False):
    pass

class NodesetRequiredHelper(Times, table=True):
    __tablename__: str = "nodeset_requirement_helper"

    __table_args__ = (
        UniqueConstraint(
            "nodeset_id",
            "required_nodeset_uri",
            "required_nodeset_version",
            name="uq_nodeset_required_helper_nodeset_uri_version",
        ),
    )
    id: int | None = Field(default=None, primary_key=True)
    nodeset_id: int = Field(foreign_key="nodeset.id")
    required_nodeset_uri: str
    required_nodeset_version: str | None


##### Modelling Rule #####
class ModellingRuleEnum(str, Enum):
    mandatory = "M"
    optional = "O"
    mandatory_placeholder = "MP"
    optional_placeholder = "OP"
    exposes_its_array = "EIA"


class ModellingRuleBase(SQLModel, table=False):
    __tablename__: str = "modelling_rule"

    id: int = Field(primary_key=True)
    rule: ModellingRuleEnum = Field(unique=True)



class ModellingRule(ModellingRuleBase, Times, table=True):
    nodes: list["Node"] = Relationship(back_populates="modelling_rule")


class ModellingRuleCreate(ModellingRuleBase, table=False):
    pass


class ModellingRulePublic(ModellingRuleBase, Times, table=False):
    id: int

class ModellingRulePublicWithLists(ModellingRulePublic, table=False):
    nodes: list["NodePublic"] = []


##### Node #####
class NodeBase(NodeBaseAttr, table=False):
    node_class_id: int = Field(foreign_key="node_class.id", index=True)
    spec_id: int | None = Field(foreign_key="spec.id")
    nodeset_id: int = Field(foreign_key="nodeset.id", index=True)
    typedefinition_id: int | None = Field(foreign_key="node.id", default=None)
    typedefinition_expanded_node_id: str | None = None
    parent_id: int | None = Field(foreign_key="node.id", default=None)
    parent_expanded_node_id: str | None = None
    data_type_id: int | None = Field(foreign_key="node.id", default=None)  # für Variable und VariableType
    data_type_expanded_node_id: str | None = None
    modelling_rule_id: int | None = Field(foreign_key="modelling_rule.id", default=None)  # für Variable und Object
    is_abstract: bool | None = Field(default=None)  # für VariableType und ObjectType


class Node(NodeBase, Times, table=True):
    __table_args__ = (
        Index(
            "ix_node_bm25",
            "id",
            "display_name",
            "definition",
            "description",
            "documentation",
            postgresql_using="bm25",
            postgresql_with={"key_field": "id"},
        ),
    )
    id: int | None = Field(default=None, primary_key=True)
    node_class: "NodeClass" = Relationship(back_populates="nodes")
    spec: "Spec" = Relationship(back_populates="nodes")
    nodeset: "Nodeset" = Relationship(back_populates="nodes", sa_relationship_kwargs={"foreign_keys": "Node.nodeset_id"})
    parent: Optional["Node"] = Relationship(back_populates="children",
                                            sa_relationship_kwargs={"remote_side": "Node.id", "foreign_keys": "Node.parent_id"})
    children: list["Node"] | None = Relationship(back_populates="parent",
                                                 sa_relationship_kwargs={"foreign_keys": "Node.parent_id"})
    typedefinition: Optional["Node"] = Relationship(back_populates="typedefinition_of",
                                                    sa_relationship_kwargs={"remote_side": "Node.id", "foreign_keys": "Node.typedefinition_id"})
    typedefinition_of: list["Node"] | None = Relationship(back_populates="typedefinition",
                                                          sa_relationship_kwargs={"foreign_keys": "Node.typedefinition_id"})
    data_type: Optional["Node"] = Relationship(back_populates="data_type_of",
                                               sa_relationship_kwargs={"remote_side": "Node.id", "foreign_keys": "Node.data_type_id"})  # für Variable und VariableType
    data_type_of: list["Node"] | None = Relationship(back_populates="data_type",
                                                     sa_relationship_kwargs={"foreign_keys": "Node.data_type_id"})
    modelling_rule: Optional["ModellingRule"] = Relationship(back_populates="nodes")  # für Variable und Object


class NodeCreate(NodeBase, table=False):
    pass

class NodeUpdate(NodeBaseAttr, table=False):
    node_class_id: int
    typedefinition_expanded_node_id: str | None = None
    parent_expanded_node_id: str | None = None
    data_type_expanded_node_id: str | None = None  # für Variable und VariableType
    modelling_rule_id: int | None = None # für Variable und Object
    is_abstract: bool | None = None # für VariableType und ObjectType und DataType

class NodePublic(NodeBase, Times, table=False):
    id: int
    node_class : "NodeClassPublic"
    spec : Optional["SpecPublic"]
    nodeset: "NodesetPublic"
    parent: Optional["NodePublicReference"]
    typedefinition: Optional["NodePublicReference"]
    data_type: Optional["NodePublic"]
    modelling_rule: Optional["ModellingRulePublic"]

class NodePublicWithLists(NodePublic, table=False):
    children: list["NodePublicReference"] = []
    typedefinition_of: list["NodePublicReference"] = []

class NodePublicReference(NodeBase, Times, table=False): #only flat hierarchy without further parent/children or typedefinition structure
    id: int
    node_class : "NodeClassPublic"
    spec : Optional["SpecPublic"]
    nodeset : "NodesetPublic"
    data_type: Optional["NodePublic"]
    modelling_rule: Optional["ModellingRulePublic"]

class NodeSemSearch(SQLModel, table=False):
    node: NodePublicWithLists
    similarity: float

##### NodeClass #####
class NodeClassEnum(str, Enum):
    variable = "Variable"
    variable_type = "VariableType"
    object = "Object"
    object_type = "ObjectType"
    method = "Method"
    data_type="DataType"


class NodeClassBase(SQLModel, table=False):
    __tablename__: str = "node_class"

    id: int = Field(primary_key=True)
    node_class: NodeClassEnum = Field(unique=True)


class NodeClass(NodeClassBase, Times, table=True):
    nodes: list["Node"] = Relationship(back_populates="node_class")


class NodeClassCreate(NodeClassBase, table=False):
    pass


class NodeClassPublic(NodeClassBase, Times, table=False):
    id: int

class NodeClassPublicWithLists(NodeClassPublic, table=False):
    nodes : list["NodePublic"] = []

##### Nodeset #####
class NodesetBase(SQLModel, table=False):
    uri: AnyHttpUrl = Field(sa_type=UriType)
    name_short: str = Field(unique=True)
    version: str
    publication_date: datetime
    download_url: AnyHttpUrl = Field(sa_type=UriType)


class Nodeset(NodesetBase, Times, table=True):
    id: int | None = Field(default=None, primary_key=True)
    specs: list["Spec"] = Relationship(back_populates="nodesets", link_model=SpecNodesetLink)
    nodes: list["Node"] = Relationship(back_populates="nodeset", sa_relationship_kwargs={"primaryjoin": "Node.nodeset_id == Nodeset.id", "foreign_keys": "Node.nodeset_id"})
    required_nodesets: list["Nodeset"] = Relationship(back_populates="required_by_nodesets",
                                                      link_model=NodesetRequiredLink,
                                                      sa_relationship_kwargs={
                                                          "primaryjoin": "Nodeset.id == NodesetRequiredLink.nodeset_id",
                                                          "secondaryjoin": "Nodeset.id == NodesetRequiredLink.required_nodeset_id"})
    required_by_nodesets: list["Nodeset"] = Relationship(back_populates="required_nodesets",
                                                         link_model=NodesetRequiredLink,
                                                         sa_relationship_kwargs={
                                                             "primaryjoin": "Nodeset.id == NodesetRequiredLink.required_nodeset_id",
                                                             "secondaryjoin": "Nodeset.id == NodesetRequiredLink.nodeset_id"})


class NodesetCreate(NodesetBase, table=False):
    pass


class NodesetPublic(NodesetBase, Times, table=False):
    id: int

class NodesetPublicWithLists(NodesetPublic, table=False):
    specs : list["SpecPublic"] = []
    required_nodesets: list["NodesetPublic"] = []
    required_by_nodesets: list["NodesetPublic"] = []


##### Spec #####
class SpecBase(SQLModel, table=False):
    number: str = Field(unique=True)
    name_long: str
    name_short: str
    version: str
    release_date: date
    summary: str | None = Field(default=None)
    summary_vector: list[float] | None = Field(
        sa_type=Vector(dim=settings.EMBEDDING_DIM), default=None
    )
    download_url: AnyHttpUrl = Field(sa_type=UriType)


class Spec(SpecBase, Times, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nodes: list["Node"] = Relationship(back_populates="spec")
    nodesets: list["Nodeset"] = Relationship(back_populates="specs", link_model=SpecNodesetLink)


class SpecCreate(SpecBase, table=False):
    pass

class SpecPublic(SpecBase, Times, table=False):
    id: int

class SpecPublicWithLists(SpecPublic, table=False):
    data_types: list["NodePublic"] = []
    nodes: list["NodePublic"] = []
    nodesets: list["NodesetPublic"] = []

class SpecSemSearch(SQLModel, table=False):
    spec: SpecPublic
    similarity: float
    

#### Update Nodes, Specs and Nodesets ####
class NodesetRequirementUpdate(SQLModel, table=False):
    required_nodeset_uri: str
    required_nodeset_version: str | None

class UpdateEntities(SQLModel, table=False):
     spec: SpecCreate
     nodeset: NodesetCreate 
     nodes: list[NodeUpdate]
     required_nodesets: list[NodesetRequirementUpdate] = []

class UpdateWarning(SQLModel, table=False):
    message: str
    expanded_node_id: str  | None = None
    field_name: str | None = None

class UpdateResponse(SQLModel, table=False):
    success: bool
    spec_number: str
    spec_version: str
    nodeset_name_short: str
    nodeset_version: str
    nodes_inserted: int = 0
    nodes_updated: int = 0
    nodes_deleted: int = 0
    references_resolved: int = 0
    references_pending: int = 0
    references_set_null: int = 0
    warnings: list[UpdateWarning]  = []

##### Metrics #####
class MetricsNodesetProvideResponse(SQLModel, table=False):
    namespaces: list[str]
    missing_dependencies: list[str] = []

class CsvFile(SQLModel, table=False):
    filename: str
    content: str

class MetricsAnalyzeResponse(SQLModel, table=False):
    namespace_uri: str
    csv_files: list["CsvFile"]
    
##### Linting #####
class LintingNodesetProvideResponse(SQLModel, table=False):
    namespaces: list[str]
    missing_dependencies: list[str] = []

class LintingAnalyzeResponse(SQLModel, table=False):
    namespace_uri: str
    csv_files: list["CsvFile"]