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


from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Depends

from app.models import MetricsAnalyzeResponse, MetricsNodesetProvideResponse, CsvFile
from app.api.deps import SessionDep
from app.services.metrics_handling import *
from fastapi.responses import StreamingResponse


router = APIRouter(prefix="/metrics", tags=["metrics"])

async def parse_additional_nodesets(request: Request) -> list[UploadFile]:
    """Filtert leere Strings raus, die Swagger UI sendet."""
    form = await request.form()
    files = []
    for key, value in form.multi_items():
        if key == "additional_nodeset_files" and isinstance(value, UploadFile) and value.filename:
            files.append(value)
    return files

@router.post("/provide")
async def provide(session: SessionDep,
                  file: UploadFile = File(...),
                  additional_nodeset_files: list[UploadFile] = Depends(parse_additional_nodesets)) -> MetricsNodesetProvideResponse:
    
    cleanup()
    ensure_metrics_tool_up_to_date()

    if not file.filename.endswith(".xml"):
        raise HTTPException(400, "Only XML files allowed")
    
    content = await file.read()
    save_upload(content)
    namespaces = parse_namespaces()


    if not namespaces:
        raise HTTPException(400, "No Namespace URIs found in XML")
    
    additional_content = []
    if additional_nodeset_files:
        for f in additional_nodeset_files:
            filename = f.filename
            if not filename or not filename.endswith(".xml"):
                raise HTTPException(400, f"Only XML files allowed, got: {filename}")
            content = await f.read()
            additional_content.append((filename, content))

    save_additional_nodesets(additional_content)
    missing_dependencies = download_dependencies(session)


    return MetricsNodesetProvideResponse(
        namespaces=namespaces,
        missing_dependencies=missing_dependencies
    )

@router.post("/provide_additional_nodesets")
async def provide_additional_nodesets(
    session: SessionDep,
    files: list[UploadFile] = File(...)
) -> MetricsNodesetProvideResponse:
    if not XMLS_DIR.exists():
        raise HTTPException(400, "No session found. Call /provide first.")

    additional_content = []
    for f in files:
        filename = f.filename
        if not filename or not filename.endswith(".xml"):
            raise HTTPException(400, f"Only XML files allowed, got: {filename}")
        content = await f.read()
        additional_content.append((filename, content))

    save_additional_nodesets(additional_content)

    all_namespaces = parse_namespaces()
    missing_dependencies = download_dependencies(session)

    return MetricsNodesetProvideResponse(
        namespaces=all_namespaces,
        missing_dependencies=missing_dependencies
    )


@router.get("/analyze")
def analyze(namespace_uri: str) -> MetricsAnalyzeResponse:
    
    ensure_metrics_tool_up_to_date()

    if namespace_uri not in parse_namespaces():
        raise HTTPException(400, "Namespace not in the provided file")

    run_metrics(namespace_uri)

    csv_files = [CsvFile(**f) for f in collect_csv_files()]

    return MetricsAnalyzeResponse(
        namespace_uri=namespace_uri,
        csv_files=csv_files
    )

@router.get("/download")
def download() -> StreamingResponse:
    zip_buffer = zip_csv_files()
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="metrics.zip"'
        },
    )