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


from sqlalchemy.exc import IntegrityError
import logging
import re
import unicodedata

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from sqlmodel import select
from sqlalchemy import func, text, literal_column, bindparam, Text
from typing import Optional, List
from sqlalchemy.orm import sessionmaker
import httpx

from app.models import Node, NodeCreate, NodeUpdate, NodePublic, NodePublicWithLists, NodeSemSearch, NodeClassEnum, NodeClass, Nodeset
from app.api.deps import SessionDep
from app.core.config import settings
from app.services.embeddings import embed_node_fields, get_embedding_service


logger = logging.getLogger("nodes-search")


def _normalize_query(raw_query: str) -> str:
    # Normalize text so lexical and dense retrieval see the same cleaned input.
    normalized = unicodedata.normalize("NFKC", raw_query)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized.casefold()


def _clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(value, max_value))



router = APIRouter(prefix="/nodes", tags=["nodes"])

@router.get("/{node_id}")
def read_node(node_id: int, session: SessionDep) -> NodePublicWithLists:
    node = session.get(Node, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/")
def read_nodes(session: SessionDep,
               id: Optional[int] = None,
               display_name: Optional[str] = None,
               expanded_node_id: Optional[str] = None,
               node_class: Optional[NodeClassEnum] = None,
               nodeset_uri: Optional[str] = None
               ) -> list[NodePublicWithLists]:
    query = select(Node)

    if id is not None:
        query = query.where(Node.id == id)

    if display_name is not None:
        query = query.where(Node.display_name == display_name)

    if expanded_node_id is not None:
        query = query.where(Node.expanded_node_id == expanded_node_id)

    if node_class is not None: 
        query = query.join(NodeClass, Node.node_class_id == NodeClass.id).where(NodeClass.node_class == node_class)

    if nodeset_uri is not None: 
        query = query.join(Nodeset, Node.nodeset_id == Nodeset.id).where(Nodeset.uri == nodeset_uri) 

    result = session.exec(query).all()

    return result


@router.post("/", response_model=NodePublic)
def create_node(node: NodeCreate,
                session: SessionDep,
                background: BackgroundTasks,) -> NodePublic:
    db_node = Node.model_validate(node)
    session.add(db_node)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Node already exists")
    session.refresh(db_node)

    if settings.EMBEDDING_ON_WRITE:
        # Build SessionMaker for BackgroundTask
        engine = session.get_bind()
        SessionMaker = sessionmaker(bind=engine, class_=type(session), expire_on_commit=False)
        background.add_task(embed_node_fields, db_node.id, SessionMaker)
    
    return db_node

@router.patch("/{node_id}", response_model=NodePublic)
def update_node(node_id: int,
                patch: NodeUpdate,
                session: SessionDep,
                background: BackgroundTasks,) -> NodePublic:
    db_node = session.get(Node, node_id)
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")

    data = patch.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    for k, v in data.items():
        setattr(db_node, k, v)

    session.add(db_node)
    session.commit()
    session.refresh(db_node)
    return db_node


@router.get("/semantic_search/", response_model=List[NodeSemSearch])
def semantic_search_nodes(q: str = Query(..., min_length=2),
                          nodeset_id: Optional[List[int]] = Query(None),
                          node_class: Optional[List[NodeClassEnum]] = Query(None),
                          limit: int = Query(settings.NODE_SEARCH_LIMIT_DEFAULT, ge=1),
                          rrf_k: int = Query(settings.NODE_SEARCH_RRF_K_DEFAULT, ge=1),
                          session: SessionDep = None) -> list[NodeSemSearch]:
    normalized_q = _normalize_query(q)
    if len(normalized_q) < 2:
        return []

    limit = _clamp(limit, 1, settings.NODE_SEARCH_LIMIT_MAX)
    rrf_k = _clamp(rrf_k, settings.NODE_SEARCH_RRF_K_MIN, settings.NODE_SEARCH_RRF_K_MAX)

    lexical_candidate_limit = max(limit * settings.NODE_SEARCH_LEX_MULTIPLIER, limit)
    dense_candidate_limit = max(limit * settings.NODE_SEARCH_DENSE_MULTIPLIER, limit)
    trigram_candidate_limit = max(limit * settings.NODE_SEARCH_TRIGRAM_MULTIPLIER, limit)

    def _apply_semantic_search_filters(
            query, 
            nodeset_id: Optional[List[int]],
            node_class: Optional[List[NodeClassEnum]]
    ):
        if nodeset_id is not None:
            query = query.where(Node.nodeset_id.in_(nodeset_id))

        if node_class is not None:
            node_class_id_subquery = (
                select(NodeClass.id)
                .where(NodeClass.node_class.in_(node_class))
            )
            query = query.where(Node.node_class_id.in_(node_class_id_subquery))

        return query

    # ---------------------------------------
    # 1. Lexical Search using BM25 (ParadeDB)
    # ---------------------------------------
    # Use the ParadeDB BM25 index created in the migration    
    # Build the base BM25 query for text search
    # First where statement: only rows matching the text query
    query_lex = (
        select(Node, func.paradedb.score(Node.id).label("bm25_score"))
        .where(
            text(
                "id @@@ paradedb.disjunction_max(ARRAY[ "
                "  paradedb.match('display_name', :q), "
                "  paradedb.match('definition',   :q), "
                "  paradedb.match('description',  :q), "
                "  paradedb.match('documentation',:q) "
                "])"
            ).bindparams(bindparam("q", type_=Text))
        )
        .params(q=normalized_q)
    )
    
    # Second where statement: optional numeric filter on nodeset_id
    query_lex = _apply_semantic_search_filters(query_lex, nodeset_id, node_class)
    
    # Now add ordering and limit
    query_lex = query_lex.order_by(text("bm25_score DESC")).limit(lexical_candidate_limit)
    
    # Execute the query
    res_lexical = session.exec(query_lex).all() # [(Node, bm25_score), ...]
    candidate_nodes = {node.id: node for node, _score in res_lexical}
    
    # Build rank map for BM25 results (1-based ranks)
    # RRF uses ranks, not scores; we still compute bm25_score, but only for debugging if needed.
    rank_lexical = {}     # node_id -> rank
    for idx, (node, _score) in enumerate(res_lexical, start=1):
        rank_lexical[node.id] = idx

    # ---------------------------------------------------------
    # 1b) Typo-tolerant lexical fallback using trigram matching
    # ---------------------------------------------------------
    rank_trigram = {}
    trigram_score_by_id: dict[int, float] = {}
    if settings.NODE_SEARCH_ENABLE_TRIGRAM_FALLBACK:
        trigram_score = func.similarity(func.lower(Node.display_name), normalized_q).label("trgm_score")
        query_trigram = (
            select(Node, trigram_score)
            .where(trigram_score >= settings.NODE_SEARCH_TRIGRAM_THRESHOLD)
        )

        query_trigram = _apply_semantic_search_filters(query_trigram, nodeset_id, node_class)

        query_trigram = query_trigram.order_by(text("trgm_score DESC")).limit(trigram_candidate_limit)
        res_trigram = session.exec(query_trigram).all()

        for idx, (node, score) in enumerate(res_trigram, start=1):
            rank_trigram[node.id] = idx
            trigram_score_by_id[node.id] = score
            candidate_nodes[node.id] = node
        

    # ------------------------------------------
    # 2. Dense Vector Search (Cosine Similarity)
    # ------------------------------------------
    res_dense = []
    try:
        emb = get_embedding_service().embed_one(normalized_q)
    except httpx.HTTPError:
        if not settings.NODE_SEARCH_ENABLE_DENSE_FALLBACK:
            raise HTTPException(status_code=503, detail="Embedding service unavailable")
        logger.warning("Embedding service unavailable; falling back to lexical-only node search")
        emb = None

    if emb:
        emb_literal = "[" + ",".join(map(str, emb)) + "]"

        # Query field-specific dense candidates and merge in Python by best score.
        sim_display_name = literal_column(
            f"1 - (display_name_vector <=> '{emb_literal}'::vector)"
        ).label("dense_sim")
        sim_def = literal_column(
            f"1 - (definition_vector <=> '{emb_literal}'::vector)"
        ).label("dense_sim")
        sim_desc = literal_column(
            f"1 - (description_vector <=> '{emb_literal}'::vector)"
        ).label("dense_sim")

        query_dense_display_name = (
            select(Node, sim_display_name)
            .where(text("display_name_vector IS NOT NULL"))
        )
        query_dense_def = (
            select(Node, sim_def)
            .where(text("definition_vector IS NOT NULL"))
        )
        query_dense_desc = (
            select(Node, sim_desc)
            .where(text("description_vector IS NOT NULL"))
        )

        query_dense_display_name = _apply_semantic_search_filters(query_dense_display_name, nodeset_id, node_class)
        query_dense_def = _apply_semantic_search_filters(query_dense_def, nodeset_id, node_class)
        query_dense_desc = _apply_semantic_search_filters(query_dense_desc, nodeset_id, node_class)

        query_dense_display_name = (
            query_dense_display_name
            .order_by(sim_display_name.desc())
            .limit(dense_candidate_limit)
        )
        query_dense_def = (
            query_dense_def
            .order_by(sim_def.desc())
            .limit(dense_candidate_limit)
        )
        query_dense_desc = (
            query_dense_desc
            .order_by(sim_desc.desc())
            .limit(dense_candidate_limit)
        )

        res_dense_display_name = session.exec(query_dense_display_name).all()
        res_dense_def = session.exec(query_dense_def).all()
        res_dense_desc = session.exec(query_dense_desc).all()

        dense_best_by_id: dict[int, tuple[Node, float]] = {}
        for node, sim in [*res_dense_display_name, *res_dense_def, *res_dense_desc]:
            existing = dense_best_by_id.get(node.id)
            if existing is None or sim > existing[1]:
                dense_best_by_id[node.id] = (node, sim)

        res_dense = sorted(
            dense_best_by_id.values(),
            key=lambda row: row[1],
            reverse=True,
        )[:dense_candidate_limit]
        candidate_nodes.update({node.id: node for node, _sim in res_dense})
    
    # Build rank map for dense results (1-based ranks)
    rank_dense = {}     # node_id -> rank
    for idx, (node, _sim) in enumerate(res_dense, start=1):
        rank_dense[node.id] = idx
    

    # -------------------------------------------
    # 3. RRF Fusion (rank-based, scale-invariant)
    # -------------------------------------------
    # RRF(d) = sum_r 1 / (k + rank_r(d))
    # We only need ranks from each list; absolute score magnitudes are ignored on purpose.
    weight_lexical = settings.NODE_SEARCH_WEIGHT_LEXICAL
    weight_dense = settings.NODE_SEARCH_WEIGHT_DENSE
    weight_trigram = settings.NODE_SEARCH_WEIGHT_TRIGRAM
    
    all_ids = set(rank_lexical.keys()) | set(rank_dense.keys()) | set(rank_trigram.keys())
    
    def rrf(doc_id: int) -> float:
        """Compute Reciprocal Rank Fusion score for a given doc_id."""
        s = 0.0
        if doc_id in rank_lexical:
            s += weight_lexical * (1.0 / (rrf_k + rank_lexical[doc_id]))
        if doc_id in rank_dense:
            s += weight_dense * (1.0 / (rrf_k + rank_dense[doc_id]))
        if doc_id in rank_trigram:
            s += weight_trigram * (1.0 / (rrf_k + rank_trigram[doc_id]))

        candidate = candidate_nodes.get(doc_id)
        if candidate is not None:
            normalized_display_name = _normalize_query(candidate.display_name)
            if normalized_display_name == normalized_q:
                s += settings.NODE_SEARCH_EXACT_NAME_BONUS
            trigram_score = trigram_score_by_id.get(doc_id, 0.0)
            if trigram_score > 0.0:
                s += settings.NODE_SEARCH_DISPLAY_NAME_SIMILARITY_BONUS * trigram_score
                if trigram_score >= settings.NODE_SEARCH_HIGH_TRIGRAM_THRESHOLD:
                    s += settings.NODE_SEARCH_HIGH_TRIGRAM_BONUS * trigram_score
        return s

    # Compute RRF scores for all candidates and sort descending
    fused = [(doc_id, rrf(doc_id)) for doc_id in all_ids]
    fused.sort(key=lambda x: x[1], reverse=True)
    
    # Keep top-N doc_ids by RRF
    top_ids = [doc_id for doc_id, _ in fused[:limit]]
    if not top_ids:
        return []
    
    
    # ----------------------------------------------------------------
    # 4) Load Nodes in final order and return ONLY the final RRF score
    # ----------------------------------------------------------------
    # Fetch all nodes by id in a single query, then re-order in Python.
    nodes_list = session.exec(
        select(Node)
        .where(Node.id.in_(top_ids))
    ).all()
    nodes_by_id = {n.id: n for n in nodes_list}
    
    # Build a small dict for quick lookup of the computed RRF score
    rrf_by_id = {doc_id: score for doc_id, score in fused}
        
    results: list[NodeSemSearch] = []
    for doc_id in top_ids:
        node = nodes_by_id.get(doc_id)
        if not node:
            continue
        # IMPORTANT: we expose ONLY the final RRF score as "similarity"
        results.append(
            NodeSemSearch(
                node=node,
                similarity=rrf_by_id.get(doc_id, 0.0)
            )
        )
        
    return results
        
