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
from typing import Optional

from app.models import NodesetRequiredLink, NodesetRequiredLinkCreate, NodesetRequiredLinkPublic
from app.api.deps import SessionDep



router = APIRouter(prefix="/nodeset_required", tags=["nodesets"])

@router.post("/")
def create_nodeset_required_link(nrl: NodesetRequiredLinkCreate, session: SessionDep) -> NodesetRequiredLinkPublic:

    db_nrl = NodesetRequiredLink.model_validate(nrl)

    try:
        session.add(db_nrl)
        session.commit()
        session.refresh(db_nrl)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Can't add nodeset_required_link from nodeset {db_nrl.nodeset_id} to nodeset {db_nrl.required_nodeset_id}: {e.orig}")
    return db_nrl

