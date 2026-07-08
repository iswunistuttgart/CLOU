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


import shutil
import subprocess
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

import requests
from sqlmodel import Session, select

from app.models import Nodeset

TOOLS_DIR = Path("tools")
LINTING_BINARY = TOOLS_DIR / "CLOU.Linting"

LINTING_TEMP_DIR = Path("linting_temp")
WORK_DIR = LINTING_TEMP_DIR / "upload"
XMLS_DIR = WORK_DIR / "xmls"
CSV_DIR = WORK_DIR / "csv"
DEPENDENCY_CACHE = LINTING_TEMP_DIR / "dependencies"

NODESET_NS = "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd"

CACHE_MAX_AGE = timedelta(days=90)
REQUEST_TIMEOUT = (5, 10)

# ──────────────────────────────────────────────
# Datenklassen
# ──────────────────────────────────────────────

@dataclass
class Dependency:
    """Ein RequiredModel – wird von GitHub/GitLab heruntergeladen."""
    uri: str
    version: str
    publication_date: str


@dataclass
class NamespaceModel:
    """Ein Model aus dem hochgeladenen XML – zur Analyse durch den User."""
    uri: str
    version: str
    publication_date: str
    dependencies: list[Dependency]

# ──────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────

def save_upload(content: bytes):
    """Arbeitsverzeichnis zurücksetzen und XML speichern."""
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
    XMLS_DIR.mkdir(parents=True)
    CSV_DIR.mkdir(parents=True)
    (XMLS_DIR / "nodeset.xml").write_bytes(content)


def save_additional_nodesets(files: list[tuple[str, bytes]]):
    """Zusätzliche Nodeset-Dateien speichern."""
    for filename, content in files:
        safe_name = filename if filename.endswith(".xml") else f"{filename}.xml"
        (XMLS_DIR / safe_name).write_bytes(content)

# ──────────────────────────────────────────────
# Parsing: Namespaces (Models) & Dependencies
# ──────────────────────────────────────────────

def parse_models() -> list[NamespaceModel]:
    """Liest alle <Model> (= Namespaces) und deren <RequiredModel> (= Dependencies)."""
    tree = ET.parse(XMLS_DIR / "nodeset.xml")
    root = tree.getroot()

    models_elem = root.find(f"{{{NODESET_NS}}}Models")
    if models_elem is None:
        return []

    models = []
    for model in models_elem.findall(f"{{{NODESET_NS}}}Model"):
        dependencies = [
            Dependency(
                uri=req.get("ModelUri", ""),
                version=req.get("Version", ""),
                publication_date=req.get("PublicationDate", ""),
            )
            for req in model.findall(f"{{{NODESET_NS}}}RequiredModel")
        ]
        models.append(NamespaceModel(
            uri=model.get("ModelUri", ""),
            version=model.get("Version", ""),
            publication_date=model.get("PublicationDate", ""),
            dependencies=dependencies,
        ))

    return models


def parse_namespaces() -> list[str]:
    """Gibt die Model-URIs zurück (= Namespaces zur Auswahl)."""
    return [m.uri for m in parse_models()]


def get_dependencies(namespace_uri: str) -> list[Dependency]:
    """Gibt die Dependencies (RequiredModels) für einen Namespace zurück."""
    for model in parse_models():
        if model.uri == namespace_uri:
            return model.dependencies
    return []


def get_all_dependencies() -> list[Dependency]:
    """Sammelt alle Dependencies aller Namespaces (dedupliziert nach URI)."""
    seen: set[str] = set()
    result: list[Dependency] = []
    for model in parse_models():
        for dep in model.dependencies:
            if dep.uri not in seen:
                seen.add(dep.uri)
                result.append(dep)
    return result


def _get_local_required_dependency_map() -> dict[str, list[Dependency]]:
    """Mappt lokale Model-URIs auf ihre RequiredModels aus allen lokalen XML-Dateien."""
    required_by_model: dict[str, list[Dependency]] = {}

    if not XMLS_DIR.exists():
        return required_by_model

    for xml_file in XMLS_DIR.glob("*.xml"):
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
        except ET.ParseError:
            continue

        models_elem = root.find(f"{{{NODESET_NS}}}Models")
        if models_elem is None:
            continue

        for model in models_elem.findall(f"{{{NODESET_NS}}}Model"):
            model_uri = model.get("ModelUri", "")
            if not model_uri:
                continue

            deps = [
                Dependency(
                    uri=req.get("ModelUri", ""),
                    version=req.get("Version", ""),
                    publication_date=req.get("PublicationDate", ""),
                )
                for req in model.findall(f"{{{NODESET_NS}}}RequiredModel")
                if req.get("ModelUri", "")
            ]

            if model_uri not in required_by_model:
                required_by_model[model_uri] = deps
            else:
                seen = {d.uri for d in required_by_model[model_uri]}
                for dep in deps:
                    if dep.uri not in seen:
                        required_by_model[model_uri].append(dep)
                        seen.add(dep.uri)

    return required_by_model


def _get_all_local_required_dependencies() -> list[Dependency]:
    """Sammelt alle RequiredModels aus allen lokalen XML-Dateien (dedupliziert nach URI)."""
    seen: set[str] = set()
    result: list[Dependency] = []

    for deps in _get_local_required_dependency_map().values():
        for dep in deps:
            if dep.uri in seen:
                continue
            seen.add(dep.uri)
            result.append(dep)

    return result


# ──────────────────────────────────────────────
# Dependencies herunterladen
# ──────────────────────────────────────────────

def _cache_path_for_uri(uri: str) -> Path:
    safe_name = uri.replace("http://", "").replace("https://", "").replace("/", "_")
    return DEPENDENCY_CACHE / f"{safe_name}.xml"


def _is_cache_valid(path: Path) -> bool:
    if not path.exists():
        return False
    age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
    return age < CACHE_MAX_AGE


def download_dependencies(session: Session) -> list[str]:
    """Alle Dependencies aus dem XML ermitteln, cachen und in xmls/ bereitstellen.
    Returns list of missing dependency URIs that are not in DB and not locally available.
    """
    DEPENDENCY_CACHE.mkdir(exist_ok=True)
    missing: set[str] = set()
    processed: set[str] = set()

    queue = deque(_get_all_local_required_dependencies())

    while queue:
        dep = queue.popleft()
        if not dep.uri or dep.uri in processed:
            continue
        processed.add(dep.uri)

        local_model_uris = _get_all_local_model_uris()
        local_required_map = _get_local_required_dependency_map()

        # If URI already exists in local XMLs, no fetch is needed.
        if dep.uri not in local_model_uris:
            cache_path = _cache_path_for_uri(dep.uri)

            if _is_cache_valid(cache_path):
                shutil.copy2(cache_path, XMLS_DIR / cache_path.name)
            else:
                nodeset = session.exec(
                    select(Nodeset).where(Nodeset.uri == dep.uri)
                ).first()

                if nodeset is None:
                    missing.add(dep.uri)
                    # Fallback: if this URI is present in local files, continue via local deps.
                    for local_dep in local_required_map.get(dep.uri, []):
                        if local_dep.uri and local_dep.uri not in processed:
                            queue.append(local_dep)
                    continue

                try:
                    resp = requests.get(str(nodeset.download_url), timeout=REQUEST_TIMEOUT)
                    resp.raise_for_status()
                except requests.RequestException:
                    missing.add(dep.uri)
                    current_nodeset = session.exec(
                        select(Nodeset).where(Nodeset.uri == dep.uri)
                    ).first()
                    if current_nodeset is not None:
                        for req in current_nodeset.required_nodesets:
                            req_uri = str(req.uri)
                            if req_uri and req_uri not in processed:
                                queue.append(
                                    Dependency(
                                        uri=req_uri,
                                        version=req.version,
                                        publication_date=req.publication_date.isoformat() if req.publication_date else "",
                                    )
                                )
                    continue

                cache_path.write_bytes(resp.content)
                shutil.copy2(cache_path, XMLS_DIR / cache_path.name)

        # DB-first recursion: enqueue dependencies of this dependency from DB graph.
        current_nodeset = session.exec(
            select(Nodeset).where(Nodeset.uri == dep.uri)
        ).first()
        if current_nodeset is not None:
            for req in current_nodeset.required_nodesets:
                req_uri = str(req.uri)
                if req_uri and req_uri not in processed:
                    queue.append(
                        Dependency(
                            uri=req_uri,
                            version=req.version,
                            publication_date=req.publication_date.isoformat() if req.publication_date else "",
                        )
                    )
            continue

        # Fallback recursion for locally known URIs not present in DB.
        for local_dep in local_required_map.get(dep.uri, []):
            if local_dep.uri and local_dep.uri not in processed:
                queue.append(local_dep)

    return sorted(missing)


def _get_all_local_model_uris() -> set[str]:
    """Sammelt alle Model-URIs aus allen lokalen XML-Dateien."""
    uris: set[str] = set()
    if not XMLS_DIR.exists():
        return uris
    for xml_file in XMLS_DIR.glob("*.xml"):
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            models_elem = root.find(f"{{{NODESET_NS}}}Models")
            if models_elem is not None:
                for model in models_elem.findall(f"{{{NODESET_NS}}}Model"):
                    model_uri = model.get("ModelUri", "")
                    if model_uri:
                        uris.add(model_uri)
        except ET.ParseError:
            continue
    return uris


def _is_uri_in_local_xmls(uri: str) -> bool:
    """Prüft ob eine URI bereits in den lokalen XML-Dateien (xmls_dir) vorhanden ist."""
    return uri in _get_all_local_model_uris()


# ──────────────────────────────────────────────
# Analyse
# ──────────────────────────────────────────────
def run_linter(namespace_uri: str):
    """Ruft das C#-Linting-Tool auf."""
    TOOLS_DIR.mkdir(exist_ok=True)
    LINTING_BINARY.chmod(0o755)
    
    result = subprocess.run(
        [
            str(LINTING_BINARY),
            "all",
            "-i", str(XMLS_DIR),
            "-uri", namespace_uri,
            "-o", str(CSV_DIR),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Linting-Tool Fehler: {result.stderr}")
    
    return result.stdout

def collect_csv_files() -> list[dict]:
    """Alle erzeugten CSVs einsammeln."""
    return [
        {"filename": f.name, "content": f.read_text(encoding="utf-8")}
        for f in CSV_DIR.glob("*.csv")
    ]

def zip_csv_files() -> object:
    zip_buffer = BytesIO()

    with ZipFile(zip_buffer, "w", ZIP_DEFLATED) as zip_file:
        for file_path in CSV_DIR.glob("*.csv"):
            # arcname bestimmt den Namen im ZIP
            zip_file.write(file_path, arcname=file_path.name)
    
    zip_buffer.seek(0)

    return zip_buffer


def ensure_linting_tool_up_to_date():
    """Stellt sicher, dass das mitgelieferte Linting-Tool vorhanden ist."""
    if not LINTING_BINARY.exists():
        raise RuntimeError(f"Linting-Tool nicht verfügbar: {LINTING_BINARY}")

    LINTING_BINARY.chmod(0o755)

# ──────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────

def cleanup():
    """User-Upload und CSVs löschen. Dependency-Cache bleibt."""
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
