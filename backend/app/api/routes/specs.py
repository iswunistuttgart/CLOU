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


from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, text, literal_column, bindparam, Text
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
from typing import Optional, List

from app.models import Spec, SpecPublic, SpecCreate, SpecSemSearch
from app.api.deps import SessionDep
from app.core.config import settings
from app.services.embeddings import embed_spec_fields, get_embedding_service



router = APIRouter(prefix="/specs", tags=["specs"])

@router.get("/")
def read_specs(session: SessionDep,
               id: Optional[int] = None,
               number: Optional[str] = None,
               name_long: Optional[str] = None,
               name_short: Optional[str] = None,
               version: Optional[str] = None
               ) -> list[SpecPublic]:
    query = select(Spec)

    if id is not None:
        query = query.where(Spec.id == id)

    if number is not None:
        query = query.where(Spec.number == number)

    if name_long is not None:
        query = query.where(Spec.name_long == name_long)

    if name_short is not None:
        query = query.where(Spec.name_short == name_short)

    if version is not None:
        query = query.where(Spec.version == version)

    result = session.exec(query).all()

    return result

@router.get("/{spec_id}")
def read_spec(spec_id: int, session: SessionDep) -> SpecPublic:
    spec = session.get(Spec, spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")
    return spec

@router.post("/")
def create_spec(spec: SpecCreate, 
                session: SessionDep,
                background: BackgroundTasks) -> SpecPublic:
    db_spec = Spec.model_validate(spec)

    try:
        session.add(db_spec)
        session.commit()
        session.refresh(db_spec)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Can't add Spec with name {db_spec.name_short} with version {db_spec.version}: {e.orig}")
    
    if settings.EMBEDDING_ON_WRITE:
        # Build SessionMaker for BackgroundTask
        engine = session.get_bind()
        SessionMaker = sessionmaker(bind=engine, class_=type(session), expire_on_commit=False)
        background.add_task(embed_spec_fields, db_spec.id, SessionMaker)
    
    return db_spec


@router.get("/semantic_search/", response_model=List[SpecSemSearch])
def semantic_search_specs(q: str = Query(..., min_length=2),
                          limit: int = 10,
                          rrf_k: int = 60,  # RRF dampening factor
                          session: SessionDep = None) -> list[SpecSemSearch]:
    
    # ---------------------------------------
    # 1. Lexical Search using BM25 (ParadeDB)
    # ---------------------------------------
    # Use the ParadeDB BM25 index created in the migration
    query_lex = (
        select(Spec, func.paradedb.score(Spec.id).label("bm25_score"))
        .where(
            text(
                "id @@@ paradedb.disjunction_max(ARRAY[ "
                " paradedb.match('number', :q), "
                " paradedb.match('name_long',   :q), "
                " paradedb.match('name_short',  :q), "
                " paradedb.match('summary',:q) "
                "])"
            ).bindparams(bindparam("q", type_=Text))
        )
        .order_by(func.paradedb.score(Spec.id).desc())
        .limit(limit*10) # fetch more to have enough for reranking
        .params(q=q)
    )
    res_lexical = session.exec(query_lex).all() # [(Spec, bm25_score), ...]
    
    # Build rank map for BM25 results (1-based ranks)
    # RRF uses ranks, not scores; we still compute bm25_score, but only for debugging if needed.
    rank_lexical = {}     # spec_id -> rank
    for idx, (spec, _score) in enumerate(res_lexical, start=1):
        rank_lexical[spec.id] = idx
            
    
    # ------------------------------------------
    # 2. Dense Vector Search (Cosine Similarity)
    # ------------------------------------------
    emb = get_embedding_service().embed_one(q)
    if not emb: 
        return []
    emb_literal = "[" + ",".join(map(str, emb)) + "]"
    
    # Define the similarity expression with inverted cosine similarity (this makes a higher value better)
    sim_summary = f"1 - (summary_vector <=> '{emb_literal}'::vector)"
    
    # Build the query for vector similarity search
    query_vec = (
        select(Spec, literal_column(sim_summary).label("sim_score"))
        .where(text("(summary_vector IS NOT NULL)"))
        .order_by(text("sim_score DESC"))
        .limit(limit*10)  # fetch more to have enough for reranking
    )
    res_dense = session.exec(query_vec).all()  # [(Spec, sim_score), ...]
    
    # Build rank map for dense results (1-based ranks)
    rank_dense = {}      # spec_id -> rank
    for idx, (spec, _score) in enumerate(res_dense, start=1):
        rank_dense[spec.id] = idx
          
        
    # -------------------------------------------
    # 3. RRF Fusion (rank-based, scale-invariant)
    # -------------------------------------------
    # RRF(d) = sum_r 1 / (k + rank_r(d))
    # We only need ranks from each list; absolute score magnitudes are ignored on purpose.
    weight_lexical = 1.0
    weight_dense   = 1.4
    
    all_ids = set(rank_lexical.keys()) | set(rank_dense.keys())
    
    def rrf(doc_id: int) -> float:
        """Compute Reciprocal Rank Fusion score for a given doc_id."""
        score = 0.0
        if doc_id in rank_lexical:
            score += weight_lexical / (rrf_k + rank_lexical[doc_id])
        if doc_id in rank_dense:
            score += weight_dense / (rrf_k + rank_dense[doc_id])
        return score
    
    # Compute RRF scores for all candidates and sorting desc
    fused = [(doc_id, rrf(doc_id)) for doc_id in all_ids]
    fused.sort(key=lambda x: x[1], reverse=True)
    
    # Keep only top N
    top_ids = [doc_id for doc_id, _ in fused[:limit]]
    if not top_ids:
        return []


    # ----------------------------------------------------------------
    # 4) Load Specs in final order and return ONLY the final RRF score
    # ----------------------------------------------------------------
    # Fetch all Spec objects by Id in one go, then order
    specs_list = session.exec(
        select(Spec)
        .where(Spec.id.in_(top_ids))
    ).all()
    specs_by_id = {spec.id: spec for spec in specs_list}
    
    # Build a small dict for quick lookup of the computed RRF score
    rrf_by_id = {doc_id: score for doc_id, score in fused}
    
    results: list[SpecSemSearch] = []
    for doc_id in top_ids:
        spec = specs_by_id.get(doc_id)
        if spec:
            results.append(
                SpecSemSearch(
                    spec=spec,
                    similarity=rrf_by_id.get(doc_id, 0.0)
                )
            )

    return results

