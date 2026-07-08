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
from sqlmodel import select
from typing import Optional
from sqlalchemy.exc import IntegrityError   


from app.models import DataType, DataTypeCreate, DataTypePublic
from app.api.deps import SessionDep



router = APIRouter(prefix="/datatypes", tags=["datatypes"])

@router.get("/")
def read_datatypes(session: SessionDep,
                  id : Optional[int] = None,
                  display_name : Optional[str] = None,
                  expanded_node_id : Optional[str] = None
                  ) -> list[DataTypePublic]:

    query = select(DataType)

    if id is not None:
        query = query.where(DataType.id == id)

    if display_name is not None:
        query = query.where(DataType.display_name == display_name)

    if expanded_node_id is not None:
        query = query.where(DataType.expanded_node_id == expanded_node_id)

    result = session.exec(query).all()

    return result


@router.get("/{datatype_id}")
def read_datatype(datatype_id: int, session: SessionDep) -> DataTypePublic:
    datatype = session.get(DataType, datatype_id)
    if not datatype:
        raise HTTPException(status_code=404, detail="Datatype not found")
    return datatype

@router.post("/")
def create_datatype(datatype: DataTypeCreate, session: SessionDep) -> DataTypePublic:
    db_datatype  = DataType.model_validate(datatype)
    session.add(db_datatype)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Datatype already exists")
    session.refresh(db_datatype)
    return db_datatype


