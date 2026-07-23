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

from app.models import UpdateEntities, UpdateResponse, UpdateWarning
from app.api.deps import SessionDep
from app.core.update_db import update_entries_in_db



router = APIRouter(prefix="/update_entries", tags=["update"])

@router.post("/")
def update_entries(update_request: UpdateEntities, session: SessionDep) -> UpdateResponse:
    try:
        response = update_entries_in_db(
            update_request=update_request,
            session=session
        )

        session.commit()
        return response
    except IntegrityError as e:
        session.rollback()

        return UpdateResponse(
            success=False,
            spec_number=update_request.spec.number,
            spec_version=update_request.spec.version,
            nodeset_name_short=update_request.nodeset.name_short,
            nodeset_version=update_request.nodeset.version,
            warnings=[
                UpdateWarning(
                    message=f"IntegrityError during update: {str(e.orig)}"
                )
            ]
       )
    except Exception as e:
        session.rollback()

        return UpdateResponse(
            success=False,
            spec_number=update_request.spec.number,
            spec_version=update_request.spec.version,
            nodeset_name_short=update_request.nodeset.name_short,
            nodeset_version=update_request.nodeset.version,
            warnings=[
                UpdateWarning(
                    message=f"Unexpected error during update: {str(e)}"
                )
            ],
        )
