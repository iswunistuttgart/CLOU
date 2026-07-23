import logging
import re

from app.models import *
from app.api.deps import SessionDep
from sqlmodel import select
from sqlalchemy import or_


logger = logging.getLogger("app.update-db")


def update_entries_in_db(
        update_request: UpdateEntities,
        session: SessionDep) -> UpdateResponse:

    warnings: list[UpdateWarning] = []

    incoming_nodes = update_request.nodes or []
    incoming_datatype_nodes = update_request.datatype_nodes or []

    nodes_inserted = 0
    nodes_updated = 0
    nodes_deleted = 0
    datatypes_inserted = 0
    datatypes_updated = 0
    datatypes_deleted = 0
    references_set_null = 0
    references_resolved = 0
    references_pending = 0

    should_process_update, skip_reason = _should_process_nodeset_update(
        session=session,
        incoming_nodeset=update_request.nodeset,
    )

    if not should_process_update:
        logger.info(
            "skip update spec=%s/%s nodeset=%s/%s reason=%s",
            update_request.spec.number,
            update_request.spec.version,
            update_request.nodeset.name_short,
            update_request.nodeset.version,
            skip_reason,
        )

        return UpdateResponse(
            success=True,
            spec_number=update_request.spec.number,
            spec_version=update_request.spec.version,
            nodeset_name_short=update_request.nodeset.name_short,
            nodeset_version=update_request.nodeset.version,
            warnings=[
                UpdateWarning(message=skip_reason)
            ],
        )

    spec = _upsert_spec(
        session=session,
        spec_create=update_request.spec
    )

    nodeset = _upsert_nodeset(
        session=session,
        nodeset_create=update_request.nodeset
    )
    
    _upsert_spec_nodeset_link(
        session=session,
        spec=spec,
        nodeset=nodeset
    )

    required_nodesets = getattr(
        update_request, 
        "required_nodesets",
        []
    )
    _replace_nodeset_requirement_helpers(
        session=session,
        nodeset=nodeset,
        required_nodesets=required_nodesets
    )

    (
        datatypes_inserted,
        datatypes_updated,
        existing_datatype_nodes_before_update,
    ) = _upsert_datatype_nodes(
        session=session,
        spec=spec,
        nodeset=nodeset,
        incoming_datatype_nodes=incoming_datatype_nodes,
    )

    (
        nodes_inserted,
        nodes_updated, 
        existing_nodes_before_update
    ) = _upsert_nodes(
        session=session,
        spec=spec,
        nodeset=nodeset,
        incoming_nodes=incoming_nodes
    )

    (
        deleted_count,
        references_nulled_for_deleted_nodes
    ) = _delete_removed_nodes(
        session=session,
        existing_nodes_before_update=existing_nodes_before_update,
        incoming_nodes=incoming_nodes,
        warnings=warnings
    )

    nodes_deleted += deleted_count
    references_set_null += references_nulled_for_deleted_nodes

    (
        datatypes_deleted,
        references_nulled_for_deleted_datatypes,
    ) = _delete_removed_datatype_nodes(
        session=session,
        existing_datatype_nodes_before_update=existing_datatype_nodes_before_update,
        incoming_datatype_nodes=incoming_datatype_nodes,
        warnings=warnings,
    )

    references_set_null += references_nulled_for_deleted_datatypes

    _reconcile_nodeset_required_links(session=session)


    (resolved_count, pending_count, set_null_count) = _resolve_node_references(
        session=session,
        nodeset=None,
        warnings=warnings,
        warn_for_nodeset_id=nodeset.id
    )

    references_resolved += resolved_count
    references_pending += pending_count
    references_set_null += set_null_count

    logger.info(
        "update request summary spec=%s/%s nodeset=%s/%s nodes(inserted=%d updated=%d deleted=%d) datatypes(inserted=%d updated=%d deleted=%d) refs(resolved=%d pending=%d set_null=%d) warnings=%d",
        spec.number,
        spec.version,
        nodeset.name_short,
        nodeset.version,
        nodes_inserted,
        nodes_updated,
        nodes_deleted,
        datatypes_inserted,
        datatypes_updated,
        datatypes_deleted,
        references_resolved,
        references_pending,
        references_set_null,
        len(warnings),
    )

    return UpdateResponse(
        success=True,
        spec_number=spec.number,
        spec_version=spec.version,
        nodeset_name_short=nodeset.name_short,
        nodeset_version=nodeset.version,
        nodes_inserted=nodes_inserted,
        nodes_updated=nodes_updated,
        nodes_deleted=nodes_deleted,
        references_resolved=references_resolved,
        references_pending=references_pending,
        references_set_null=references_set_null,
        warnings=warnings
    )


def _should_process_nodeset_update(
        session: SessionDep,
        incoming_nodeset: NodesetCreate,
) -> tuple[bool, str]:
    existing_nodeset = session.exec(
        select(Nodeset).where(Nodeset.name_short == incoming_nodeset.name_short)
    ).first()

    if existing_nodeset is None:
        return True, "nodeset does not exist yet"

    if _is_incoming_nodeset_version_newer(
            existing_version=existing_nodeset.version,
            incoming_version=incoming_nodeset.version):
        return (
            True,
            (
                "incoming nodeset version is newer "
                f"({incoming_nodeset.version} > {existing_nodeset.version})"
            ),
        )

    existing_nodes = session.exec(
        select(Node).where(Node.nodeset_id == existing_nodeset.id)
    ).all()

    if not existing_nodes:
        return (
            True,
            "nodeset exists but has no nodes yet (partial import recovery)",
        )

    return (
        False,
        (
            "skip update because nodeset already contains nodes and incoming "
            f"version is not newer ({incoming_nodeset.version} <= "
            f"{existing_nodeset.version})"
        ),
    )


def _is_incoming_nodeset_version_newer(
        existing_version: str,
        incoming_version: str,
) -> bool:
    return _compare_version_strings(incoming_version, existing_version) > 0


def _compare_version_strings(left: str, right: str) -> int:
    left_parts = _tokenize_version(left)
    right_parts = _tokenize_version(right)
    max_len = max(len(left_parts), len(right_parts))

    for i in range(max_len):
        left_part = left_parts[i] if i < len(left_parts) else (0, 0)
        right_part = right_parts[i] if i < len(right_parts) else (0, 0)

        part_comparison = _compare_version_part(left_part, right_part)
        if part_comparison != 0:
            return part_comparison

    return 0


def _tokenize_version(version: str) -> list[tuple[int, int | str]]:
    chunks = [chunk for chunk in re.split(r"[.\\-_/]", version) if chunk]

    if not chunks:
        return [(0, 0)]

    tokens: list[tuple[int, int | str]] = []

    for chunk in chunks:
        if chunk.isdigit():
            tokens.append((0, int(chunk)))
        else:
            tokens.append((1, chunk.lower()))

    return tokens


def _compare_version_part(
        left_part: tuple[int, int | str],
        right_part: tuple[int, int | str],
) -> int:
    left_type, left_value = left_part
    right_type, right_value = right_part

    if left_type == 0 and right_type == 0:
        return (left_value > right_value) - (left_value < right_value)

    if left_type == 1 and right_type == 1:
        return (left_value > right_value) - (left_value < right_value)

    return (left_type > right_type) - (left_type < right_type)


def _upsert_spec(session: SessionDep, spec_create: SpecCreate) -> SpecPublic:
    spec_data = _dump_model(spec_create)

    spec = session.exec(
        select(Spec).where(Spec.number == spec_create.number)
    ).first()

    if spec is None:
        spec = Spec(**spec_data)
        session.add(spec)
    else: 
        _apply_data_to_model(spec, spec_data)
        session.add(spec)

    session.flush()
    return spec

def _upsert_nodeset(session: SessionDep, nodeset_create: NodesetCreate) -> NodesetPublic:
    nodeset_data = _dump_model(nodeset_create)

    nodeset = session.exec(
        select(Nodeset).where(
            Nodeset.name_short == nodeset_create.name_short
        )
    ).first()

    if nodeset is None:
        nodeset = Nodeset(**nodeset_data)
        session.add(nodeset)
    else:
        _apply_data_to_model(nodeset, nodeset_data)
        session.add(nodeset)

    session.flush()
    return nodeset

def _upsert_spec_nodeset_link(
        session: SessionDep,
        spec: Spec,
        nodeset: Nodeset
) -> SpecNodesetLinkPublic:
    is_correct_version = _get_spec_nodeset_is_correct_version(spec, nodeset)

    link = session.exec(
        select(SpecNodesetLink).where(
            SpecNodesetLink.spec_id == spec.id,
            SpecNodesetLink.nodeset_id == nodeset.id
        )
    ).first()

    if link is None:
        link = SpecNodesetLink(
            spec_id=spec.id,
            nodeset_id=nodeset.id,
            is_correct_version=is_correct_version
        )
        session.add(link)
    else:
        link.is_correct_version = is_correct_version
        session.add(link)

    session.flush()
    return link

def _replace_nodeset_requirement_helpers(
        session: SessionDep,
        nodeset: Nodeset,
        required_nodesets: list[NodesetRequirementUpdate]
) -> int:
    existing_reqs = session.exec(
        select(NodesetRequiredHelper).where(
            NodesetRequiredHelper.nodeset_id == nodeset.id
        )
    ).all()

    for req in existing_reqs:
        session.delete(req)

    session.flush()

    inserted = 0
    seen: set[tuple[str, str]] = set()

    for required in required_nodesets:
        key = (
            required.required_nodeset_uri,
            required.required_nodeset_version
        )

        if key in seen:
            continue

        seen.add(key)

        new_req = NodesetRequiredHelper(
            nodeset_id=nodeset.id,
            required_nodeset_uri= required.required_nodeset_uri,
            required_nodeset_version=required.required_nodeset_version
        )

        session.add(new_req)
        inserted += 1

    session.flush()
    return inserted

def _upsert_nodes(
        session: SessionDep,
        spec: Spec,
        nodeset: Nodeset,
        incoming_nodes: list[NodeUpdate]
) -> tuple[int, int, list[NodePublic]]:

    existing_nodes = session.exec(
        select(Node).where(Node.nodeset_id == nodeset.id)
    ).all()

    existing_by_expanded_node_id = {
        node.expanded_node_id: node for node in existing_nodes
    }

    incoming_by_expanded_node_id = {}

    for node_request in incoming_nodes:
        if node_request.expanded_node_id in incoming_by_expanded_node_id:
            raise ValueError(
                f"Duplicate expanded_node_id in request: "
                f"{node_request.expanded_node_id}"
            )

        incoming_by_expanded_node_id[node_request.expanded_node_id] = node_request

    nodes_inserted = 0
    nodes_updated = 0

    exclude_fields = {
        "id", 
        "parent_id",
        "typedefinition_id",
        "data_type_id"
    }

    for node_request in incoming_nodes:
        node_data = _dump_model(
            node_request, exclude=exclude_fields
        )

        node_data["spec_id"] = spec.id
        node_data["nodeset_id"] = nodeset.id

        existing_node = existing_by_expanded_node_id.get(
            node_request.expanded_node_id
        )

        if existing_node is None:
            node = Node(**node_data)
            session.add(node)
            nodes_inserted += 1
        else:
            _apply_data_to_model(existing_node, node_data)
            session.add(existing_node)
            nodes_updated += 1

    session.flush()

    return nodes_inserted, nodes_updated, existing_nodes


def _upsert_datatype_nodes(
        session: SessionDep,
        spec: Spec,
        nodeset: Nodeset,
        incoming_datatype_nodes: list[DataTypeUpdate],
) -> tuple[int, int, list[DataTypePublic]]:
    existing_datatype_nodes = session.exec(
        select(DataType).where(DataType.nodeset_id == nodeset.id)
    ).all()

    incoming_by_expanded_node_id = {}
    incoming_expanded_node_ids = {
        datatype_request.expanded_node_id
        for datatype_request in incoming_datatype_nodes
    }

    globally_existing_datatypes = []

    if incoming_expanded_node_ids:
        globally_existing_datatypes = session.exec(
            select(DataType).where(
                DataType.expanded_node_id.in_(
                    list(incoming_expanded_node_ids)
                )
            )
        ).all()

    existing_by_expanded_node_id = {
        data_type.expanded_node_id: data_type
        for data_type in globally_existing_datatypes
    }

    for datatype_request in incoming_datatype_nodes:
        if datatype_request.expanded_node_id in incoming_by_expanded_node_id:
            raise ValueError(
                f"Duplicate datatype expanded_node_id in request: "
                f"{datatype_request.expanded_node_id}"
            )

        incoming_by_expanded_node_id[datatype_request.expanded_node_id] = datatype_request

    datatypes_inserted = 0
    datatypes_updated = 0

    exclude_fields = {"id"}

    for datatype_request in incoming_datatype_nodes:
        datatype_data = _dump_model(
            datatype_request,
            exclude=exclude_fields,
        )

        datatype_data["spec_id"] = spec.id
        datatype_data["nodeset_id"] = nodeset.id

        existing_datatype_node = existing_by_expanded_node_id.get(datatype_request.expanded_node_id)

        if existing_datatype_node is None:
            data_type = DataType(**datatype_data)
            session.add(data_type)
            datatypes_inserted += 1
        else:
            # DataTypes are globally unique by expanded_node_id. If a row already
            # exists, update shared fields but keep ownership (spec/nodeset) stable.
            if existing_datatype_node.nodeset_id != nodeset.id:
                datatype_data.pop("spec_id", None)
                datatype_data.pop("nodeset_id", None)

            _apply_data_to_model(existing_datatype_node, datatype_data)
            session.add(existing_datatype_node)
            datatypes_updated += 1

    session.flush()

    return datatypes_inserted, datatypes_updated, existing_datatype_nodes

def _resolve_node_references(
        session: SessionDep,
        nodeset: Nodeset | None = None,
        warnings: list[UpdateWarning] | None = None,
        warn_for_nodeset_id: int | None = None
) -> tuple[int, int, int]: 
    if warnings is None: 
        warnings = []

    references_resolved = 0
    references_pending = 0
    references_set_null = 0

    query = select(Node)

    if nodeset is not None:
        query = query.where(Node.nodeset_id == nodeset.id)

    nodes = session.exec(query).all()

    referenced_node_expanded_node_ids: set[str] = set()
    referenced_data_type_expanded_node_ids: set[str] = set()

    for node in nodes:
        if node.parent_expanded_node_id:
            referenced_node_expanded_node_ids.add(node.parent_expanded_node_id)

        if node.typedefinition_expanded_node_id:
            referenced_node_expanded_node_ids.add(
                node.typedefinition_expanded_node_id
            )

        if node.data_type_expanded_node_id:
            referenced_data_type_expanded_node_ids.add(
                node.data_type_expanded_node_id
            )

    referenced_nodes_by_expanded_node_id: dict[str, Node] = {}
    referenced_datatypes_by_expanded_node_id: dict[str, DataType] = {}

    if referenced_node_expanded_node_ids:
        referenced_nodes = session.exec(
            select(Node).where(
                Node.expanded_node_id.in_(
                    list(referenced_node_expanded_node_ids)
                )
            )
        ).all()

        referenced_nodes_by_expanded_node_id = {
            referenced_node.expanded_node_id: referenced_node
            for referenced_node in referenced_nodes
        }

    if referenced_data_type_expanded_node_ids:
        referenced_datatypes = session.exec(
            select(DataType).where(
                DataType.expanded_node_id.in_(
                    list(referenced_data_type_expanded_node_ids)
                )
            )
        ).all()

        referenced_datatypes_by_expanded_node_id = {
            referenced_datatype.expanded_node_id: referenced_datatype
            for referenced_datatype in referenced_datatypes
        }

    for node in nodes:
        changed = False

        should_warn_for_node = (
            warn_for_nodeset_id is None
            or node.nodeset_id == warn_for_nodeset_id
        )

        if node.parent_expanded_node_id:
            parent_node = referenced_nodes_by_expanded_node_id.get(
                node.parent_expanded_node_id
            )

            if parent_node is not None:
                if node.parent_id != parent_node.id:
                    node.parent_id = parent_node.id
                    references_resolved += 1
                    changed = True
            else:
                references_pending += 1

                if node.parent_id is not None:
                    node.parent_id = None
                    references_set_null += 1
                    changed = True

                if should_warn_for_node:
                    warnings.append(
                        UpdateWarning(
                            message=(
                                "Parent reference is pending because the target "
                                "node is not imported yet."
                            ),
                            expanded_node_id=node.expanded_node_id,
                            field_name="parent_id",
                        )
                    )
        else:
            if node.parent_id is not None:
                node.parent_id = None
                references_set_null += 1
                changed = True

        if node.typedefinition_expanded_node_id:
            typedefinition_node = referenced_nodes_by_expanded_node_id.get(
                node.typedefinition_expanded_node_id
            )

            if typedefinition_node is not None:
                if node.typedefinition_id != typedefinition_node.id:
                    node.typedefinition_id = typedefinition_node.id
                    references_resolved += 1
                    changed = True
            else:
                references_pending += 1

                if node.typedefinition_id is not None:
                    node.typedefinition_id = None
                    references_set_null += 1
                    changed = True

                if should_warn_for_node:
                    warnings.append(
                        UpdateWarning(
                            message=(
                                "TypeDefinition reference is pending because the "
                                "target node is not imported yet."
                            ),
                            expanded_node_id=node.expanded_node_id,
                            field_name="typedefinition_id",
                        )
                    )
        else:
            if node.typedefinition_id is not None:
                node.typedefinition_id = None
                references_set_null += 1
                changed = True

        if node.data_type_expanded_node_id:
            data_type = referenced_datatypes_by_expanded_node_id.get(
                node.data_type_expanded_node_id
            )

            if data_type is not None:
                if node.data_type_id != data_type.id:
                    node.data_type_id = data_type.id
                    references_resolved += 1
                    changed = True
            else:
                references_pending += 1

                if node.data_type_id is not None:
                    node.data_type_id = None
                    references_set_null += 1
                    changed = True

                if should_warn_for_node:
                    warnings.append(
                        UpdateWarning(
                            message=(
                                "DataType reference is pending because the target "
                                "node is not imported yet."
                            ),
                            expanded_node_id=node.expanded_node_id,
                            field_name="data_type_id",
                        )
                    )
        else:
            if node.data_type_id is not None:
                node.data_type_id = None
                references_set_null += 1
                changed = True

        if changed:
            session.add(node)

    session.flush()

    return references_resolved, references_pending, references_set_null


def _delete_removed_nodes(
    session: SessionDep,
    existing_nodes_before_update: list[NodePublic],
    incoming_nodes: list[NodeUpdate],
    warnings: list[UpdateWarning],
) -> tuple[int, int]:
    nodes_deleted = 0
    references_set_null = 0

    incoming_expanded_node_ids = {
        node.expanded_node_id
        for node in incoming_nodes
    }

    removed_nodes = [
        node
        for node in existing_nodes_before_update
        if node.expanded_node_id not in incoming_expanded_node_ids
    ]

    removed_node_ids = [
        node.id
        for node in removed_nodes
        if node.id is not None
    ]

    if removed_node_ids:
        referencing_nodes = session.exec(
            select(Node).where(
                or_(
                    Node.parent_id.in_(removed_node_ids),
                    Node.typedefinition_id.in_(removed_node_ids)
                )
            )
        ).all()

        for referencing_node in referencing_nodes:
            changed = False

            if referencing_node.parent_id in removed_node_ids:
                referencing_node.parent_id = None
                references_set_null += 1
                changed = True

                warnings.append(
                    UpdateWarning(
                        message="Reference to deleted parent node set to NULL.",
                        expanded_node_id=referencing_node.expanded_node_id,
                        field_name="parent_id",
                    )
                )

            if referencing_node.typedefinition_id in removed_node_ids:
                referencing_node.typedefinition_id = None
                references_set_null += 1
                changed = True

                warnings.append(
                    UpdateWarning(
                        message="Reference to deleted typedefinition node set to NULL.",
                        expanded_node_id=referencing_node.expanded_node_id,
                        field_name="typedefinition_id",
                    )
                )

            if changed:
                session.add(referencing_node)

        session.flush()

    for node in removed_nodes:
        session.delete(node)
        nodes_deleted += 1

    session.flush()

    return nodes_deleted, references_set_null


def _delete_removed_datatype_nodes(
    session: SessionDep,
    existing_datatype_nodes_before_update: list[DataTypePublic],
    incoming_datatype_nodes: list[DataTypeUpdate],
    warnings: list[UpdateWarning],
) -> tuple[int, int]:
    datatypes_deleted = 0
    references_set_null = 0

    incoming_expanded_node_ids = {
        datatype.expanded_node_id
        for datatype in incoming_datatype_nodes
    }

    removed_datatypes = [
        datatype
        for datatype in existing_datatype_nodes_before_update
        if datatype.expanded_node_id not in incoming_expanded_node_ids
    ]

    removed_datatype_ids = [
        datatype.id
        for datatype in removed_datatypes
        if datatype.id is not None
    ]

    if removed_datatype_ids:
        referencing_nodes = session.exec(
            select(Node).where(
                Node.data_type_id.in_(removed_datatype_ids)
            )
        ).all()

        for referencing_node in referencing_nodes:
            referencing_node.data_type_id = None
            references_set_null += 1
            session.add(referencing_node)

            warnings.append(
                UpdateWarning(
                    message="Reference to deleted data type node set to NULL.",
                    expanded_node_id=referencing_node.expanded_node_id,
                    field_name="data_type_id",
                )
            )

        session.flush()

    for datatype in removed_datatypes:
        session.delete(datatype)
        datatypes_deleted += 1

    session.flush()

    return datatypes_deleted, references_set_null

def _reconcile_nodeset_required_links(session: SessionDep) -> None:
    helpers = session.exec(
        select(NodesetRequiredHelper)
    ).all()

    desired_links: dict[tuple[int, int], bool] = {}

    for helper in helpers:
        required_nodeset = session.exec(
            select(Nodeset).where(
                Nodeset.uri == helper.required_nodeset_uri
            )
        ).first()

        if required_nodeset is None:
            continue

        is_correct_version = (
            required_nodeset.version == helper.required_nodeset_version
        )

        key = (
            helper.nodeset_id,
            required_nodeset.id,
        )

        desired_links[key] = is_correct_version

    existing_links = session.exec(
        select(NodesetRequiredLink)
    ).all()

    existing_by_key = {
        (
            link.nodeset_id,
            link.required_nodeset_id,
        ): link
        for link in existing_links
    }

    for key, existing_link in existing_by_key.items():
        if key not in desired_links:
            session.delete(existing_link)

    for key, is_correct_version in desired_links.items():
        nodeset_id, required_nodeset_id = key

        existing_link = existing_by_key.get(key)

        if existing_link is None:
            link = NodesetRequiredLink(
                nodeset_id=nodeset_id,
                required_nodeset_id=required_nodeset_id,
                is_correct_version=is_correct_version,
            )
            session.add(link)
        else:
            existing_link.is_correct_version = is_correct_version
            session.add(existing_link)

    session.flush()

def _get_spec_nodeset_is_correct_version(spec: Spec, nodeset: Nodeset) -> bool:
    return spec.version == nodeset.version

def _dump_model(model, exclude: set[str] | None = None) -> dict:
    exclude = exclude or set()

    if hasattr(model, "model_dump"):
        return model.model_dump(exclude=exclude)

    return model.dict(exclude=exclude)

def _apply_data_to_model(db_obj, data: dict) -> None:
    for key, value in data.items():
        if hasattr(db_obj, key):
            setattr(db_obj, key, value)