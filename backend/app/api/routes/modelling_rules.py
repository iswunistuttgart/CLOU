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


from app.models import ModellingRule, ModellingRulePublic
from app.api.deps import SessionDep



router = APIRouter(prefix="/modelling_rules", tags=["modelling_rules"])

@router.get("/{modelling_rule_id}")
def read_modelling_rule(modelling_rule_id: int, session: SessionDep) -> ModellingRulePublic:
    modelling_rule = session.get(ModellingRule, modelling_rule_id)
    if not modelling_rule:
        raise HTTPException(status_code=404, detail="ModellingRule not found")
    return modelling_rule



