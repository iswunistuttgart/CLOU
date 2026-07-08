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
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from typing import Optional

from app.models import Unit, UnitCreate, UnitPublicWithLists
from app.api.deps import SessionDep



router = APIRouter(prefix="/units", tags=["units"])

@router.get("/{unit_id}")
def read_unit(unit_id: int, session: SessionDep) -> UnitPublicWithLists:
    unit = session.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit

@router.get("/")
def read_units(session: SessionDep,
               id: Optional[int] = None,
               display_name: Optional[str] = None,
               description: Optional[str] = None
               ) -> list[UnitPublicWithLists]:
    query = select(Unit)

    if id is not None:
        query = query.where(Unit.id == id)

    if display_name is not None:
        query = query.where(Unit.display_name == display_name)

    if description is not None:
        query = query.where(Unit.description == description)

    result = session.exec(query).all()

    return result ##todo: probieren, ob bei verwendung von parametern und 1 oder 0 ergegbnissen auch liste zuückkommt

@router.post("/")
def create_unit(unit: UnitCreate, session: SessionDep) -> UnitPublicWithLists:
    db_unit = Unit.model_validate(unit)

    try:
        session.add(db_unit)
        session.commit()
        session.refresh(db_unit)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Can't add Unit with name {db_unit.display_name} and id {db_unit.id}: {e.orig}")
    return db_unit


