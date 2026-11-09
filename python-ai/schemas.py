from pydantic import BaseModel


class AnalysisResponse(BaseModel):
    success: bool
    caption: str | None = None
    detailed_caption: str | None = None
    objects: list[dict] = []          # [{"label": str, "bbox": [x1,y1,x2,y2] | None}]
    object_count: int = 0
    ocr_text: str | None = None
    model_name: str = "Florence-2-base"
    model_revision: str = ""
    processing_time_ms: int = 0
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    model_name: str
    model_loaded: bool
    model_revision: str
    device: str
