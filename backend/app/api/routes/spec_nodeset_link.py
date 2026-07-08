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


from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import SpecNodesetLink, SpecNodesetLinkPublic, SpecNodesetLinkCreate, Nodeset, Spec, NodesetPublicWithLists, SpecPublicWithLists

router = APIRouter(prefix="/spec_nodeset_link", tags=["nodesets", "specs"])

@router.post("/")
def create_spec_nodeset_link(snl: SpecNodesetLinkCreate, session: SessionDep) -> SpecNodesetLinkPublic:

    db_snl = SpecNodesetLink.model_validate(snl)
    try:
        session.add(db_snl)
        session.commit()
        session.refresh(db_snl)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Can't add spec_nodeset_link from spec {db_snl.spec_id} to nodeset {db_snl.nodeset_id}: {e.orig}")
    return db_snl

@router.get("/solo_nodeset")
def get_solo_nodesets(session: SessionDep) -> list[NodesetPublicWithLists]:

    statement = select(Nodeset).where(~Nodeset.specs.any())
    solo_nodesets = session.exec(statement).all()
    return solo_nodesets

@router.get("/solo_spec")
def get_solo_specs(session: SessionDep) -> list[SpecPublicWithLists]:

    statement = select(Spec).where(~Spec.nodesets.any())
    solo_specs = session.exec(statement).all()
    return solo_specs