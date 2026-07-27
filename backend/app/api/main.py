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


from app.api.routes import modelling_rules, nodes, nodeset_required, nodesets, spec_nodeset_link, specs, metrics, utils, linting, update_entries
from fastapi import APIRouter

from app.api.routes import units

api_router = APIRouter()

api_router.include_router(nodes.router)
api_router.include_router(nodesets.router)
api_router.include_router(nodeset_required.router)
api_router.include_router(spec_nodeset_link.router)
api_router.include_router(specs.router)
api_router.include_router(units.router)
api_router.include_router(modelling_rules.router)
api_router.include_router(update_entries.router)
api_router.include_router(metrics.router)
api_router.include_router(utils.router)
api_router.include_router(linting.router)
