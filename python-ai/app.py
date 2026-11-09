from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import settings
from model import Florence2Manager
from preprocess import validate_and_load
from inference import run_florence2
from schemas import AnalysisResponse, HealthResponse


# ── Lifespan: load model on startup ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    mgr = Florence2Manager()
    print(f"[florence2-service] Loading {settings.model_name} on {settings.device}…")
    mgr.load()
    print(f"[florence2-service] Model ready. Revision: {mgr.revision}")
    yield


app = FastAPI(title="Florence-2 Inference Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
_bearer = HTTPBearer()


def verify_token(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    if creds.credentials != settings.florence2_secret:
        raise HTTPException(status_code=401, detail="Invalid bearer token")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
def health():
    return Florence2Manager().health()


@app.post("/analyze", response_model=AnalysisResponse, dependencies=[Depends(verify_token)])
async def analyze(
    image: UploadFile = File(...),
    tasks: str = Form(default="caption,detailed_caption,object_detection"),
):
    mgr = Florence2Manager()
    if not mgr.loaded:
        raise HTTPException(status_code=503, detail="Model is not ready")

    data = await image.read()
    try:
        pil_image = validate_and_load(data)
    except ValueError as exc:
        return AnalysisResponse(success=False, error=str(exc))

    task_list = [t.strip() for t in tasks.split(",") if t.strip()]
    try:
        result = run_florence2(pil_image, task_list)
    except Exception as exc:
        return AnalysisResponse(success=False, error=f"Inference error: {exc}")

    return AnalysisResponse(
        success=True,
        model_name="Florence-2-base",
        model_revision=mgr.revision,
        **result,
    )
