from __future__ import annotations

import io
import os
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ENGINE_ROOT = ROOT / ".tools" / "stable-fast-3d"
OUTPUT_ROOT = ROOT / ".tools" / "ai3d-output"
MODEL_ID = os.environ.get("BRICKFORGE_SF3D_MODEL", "stabilityai/stable-fast-3d")
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_JOBS = 20

if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))


@dataclass
class Job:
    id: str
    status: Literal["queued", "running", "complete", "failed"]
    created_at: float
    message: str
    progress: int = 0
    output_path: str | None = None


app = FastAPI(title="BrickForge Local AI 3D", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://brickforge-ai.cosmicsanctuaryobser.chatgpt.site",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5176",
        "http://localhost:5173",
        "http://localhost:5176",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def private_network_access(request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Cache-Control"] = "no-store"
    return response


jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="brickforge-ai3d")
model_lock = threading.Lock()
model = None
rembg_session = None


def model_is_cached() -> bool:
    if Path(MODEL_ID).is_dir():
        return True
    try:
        from huggingface_hub import scan_cache_dir

        return any(repo.repo_id == MODEL_ID for repo in scan_cache_dir().repos)
    except Exception:
        return False


def token_is_configured() -> bool:
    try:
        from huggingface_hub import HfFolder

        return bool(HfFolder.get_token())
    except Exception:
        return False


def update_job(job_id: str, **changes) -> None:
    with jobs_lock:
        job = jobs[job_id]
        for key, value in changes.items():
            setattr(job, key, value)


def get_model():
    global model, rembg_session
    if model is not None:
        return model, rembg_session
    with model_lock:
        if model is not None:
            return model, rembg_session
        import rembg
        import torch
        from sf3d.system import SF3D

        if not torch.cuda.is_available():
            raise RuntimeError("A CUDA-capable NVIDIA GPU is required")
        loaded = SF3D.from_pretrained(
            MODEL_ID, config_name="config.yaml", weight_name="model.safetensors"
        )
        loaded.to("cuda")
        loaded.eval()
        model = loaded
        rembg_session = rembg.new_session()
        return model, rembg_session


def generate_mesh(job_id: str, image_bytes: bytes) -> None:
    update_job(job_id, status="running", message="Loading local AI model", progress=10)
    try:
        import torch
        from sf3d.utils import remove_background, resize_foreground

        loaded_model, background_session = get_model()
        update_job(job_id, message="Removing the background", progress=25)
        source = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        source = remove_background(source, background_session)
        source = resize_foreground(source, 0.85)
        update_job(job_id, message="Generating the 3D mesh on the GPU", progress=45)
        with torch.inference_mode(), torch.autocast(device_type="cuda", dtype=torch.bfloat16):
            mesh, _ = loaded_model.run_image(
                source, bake_resolution=512, remesh="none", vertex_count=-1
            )
        update_job(job_id, message="Exporting an OBJ for BrickForge", progress=90)
        job_dir = OUTPUT_ROOT / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        output = job_dir / "brickforge-ai-model.obj"
        mesh.export(output, file_type="obj", include_normals=True)
        update_job(
            job_id,
            status="complete",
            message="AI mesh ready",
            progress=100,
            output_path=str(output),
        )
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        if "gated" in message.lower() or "401" in message:
            message = (
                "Stable Fast 3D weights are gated. Accept the model licence on "
                "Hugging Face, then run scripts\\login-ai3d.ps1."
            )
        update_job(job_id, status="failed", message=message[:500], progress=0)


def prune_jobs() -> None:
    with jobs_lock:
        completed = sorted(jobs.values(), key=lambda item: item.created_at)
        for old in completed[:-MAX_JOBS]:
            if old.status in {"complete", "failed"}:
                jobs.pop(old.id, None)


@app.get("/v1/health")
def health():
    try:
        import torch

        gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        cuda = torch.cuda.is_available()
    except Exception:
        gpu, cuda = None, False
    cached = model_is_cached()
    authenticated = token_is_configured()
    ready = ENGINE_ROOT.is_dir() and cuda and (cached or authenticated)
    reason = None
    if not ENGINE_ROOT.is_dir():
        reason = "Stable Fast 3D engine is not installed"
    elif not cuda:
        reason = "CUDA GPU is unavailable"
    elif not (cached or authenticated):
        reason = "Model access is not configured; run scripts\\login-ai3d.ps1"
    return {
        "service": "brickforge-local-ai3d",
        "engine": "Stable Fast 3D",
        "ready": ready,
        "reason": reason,
        "gpu": gpu,
        "modelCached": cached,
        "authenticated": authenticated,
        "queueDepth": sum(job.status in {"queued", "running"} for job in jobs.values()),
    }


@app.post("/v1/generate", status_code=202)
async def create_job(image: UploadFile = File(...)):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Choose a JPG, PNG, or WebP image")
    payload = await image.read(MAX_IMAGE_BYTES + 1)
    if not payload:
        raise HTTPException(400, "The uploaded image is empty")
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Images must be 10 MB or smaller")
    prune_jobs()
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = Job(job_id, "queued", time.time(), "Waiting for the GPU")
    executor.submit(generate_mesh, job_id, payload)
    return asdict(jobs[job_id])


@app.get("/v1/jobs/{job_id}")
def job_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown generation job")
        return asdict(job)


@app.get("/v1/jobs/{job_id}/model")
def job_model(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown generation job")
        if job.status != "complete" or not job.output_path:
            raise HTTPException(409, "The mesh is not ready")
        path = Path(job.output_path)
    if not path.is_file():
        raise HTTPException(410, "The generated mesh has expired")
    return FileResponse(path, media_type="model/obj", filename=path.name)
