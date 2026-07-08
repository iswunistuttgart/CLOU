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
from pydantic import AnyHttpUrl
from datetime import datetime

from app.models import Nodeset, NodesetPublic, NodesetCreate, NodesetPublicWithLists
from app.api.deps import SessionDep



router = APIRouter(prefix="/nodesets", tags=["nodesets"])

@router.get("/")
def read_nodesets(session: SessionDep,
                  id: Optional[int] = None,
                  uri: Optional[AnyHttpUrl] = None,
                  name_short: Optional[str] = None,
                  version: Optional[str] = None,
                  publication_date: Optional[datetime] = None
                  ) -> list[NodesetPublicWithLists]:
    query = select(Nodeset)

    if id is not None:
        query = query.where(Nodeset.id == id)

    if uri is not None:
        query = query.where(Nodeset.uri == uri)

    if name_short is not None:
        query = query.where(Nodeset.name_short == name_short)

    if version is not None:
        query = query.where(Nodeset.version == version)

    if publication_date is not None:
        query = query.where(Nodeset.publication_date == publication_date)

    result = session.exec(query).all()

    return result

@router.get("/{nodeset_id}")
def read_nodeset(nodeset_id: int, session: SessionDep) -> NodesetPublicWithLists:
    nodeset = session.get(Nodeset, nodeset_id)
    if not nodeset:
        raise HTTPException(status_code=404, detail="Nodeset not found")
    return nodeset

@router.post("/")
def create_nodeset(nodeset: NodesetCreate, session: SessionDep) -> NodesetPublic:
    db_nodeset = Nodeset.model_validate(nodeset)

    try:
        session.add(db_nodeset)
        session.commit()
        session.refresh(db_nodeset)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Can't add Nodeset with name {db_nodeset.name_short} with version {db_nodeset.version}: {e.orig}")
    return db_nodeset



