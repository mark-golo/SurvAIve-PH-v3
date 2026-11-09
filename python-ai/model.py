import threading
import torch
from transformers import AutoProcessor, AutoModelForCausalLM
from config import settings


class Florence2Manager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._loaded = False
                cls._instance._model = None
                cls._instance._processor = None
                cls._instance._revision = settings.model_revision
        return cls._instance

    def load(self):
        if self._loaded:
            return
        self._processor = AutoProcessor.from_pretrained(
            settings.model_name,
            revision=settings.model_revision,
            trust_remote_code=True,
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            settings.model_name,
            revision=settings.model_revision,
            trust_remote_code=True,
            torch_dtype=torch.float32,
        ).to(settings.device)
        self._model.eval()
        # Store the resolved commit SHA as revision string
        try:
            from huggingface_hub import model_info
            info = model_info(settings.model_name, revision=settings.model_revision)
            self._revision = info.sha[:8] if info.sha else settings.model_revision
        except Exception:
            self._revision = settings.model_revision
        self._loaded = True

    @property
    def processor(self):
        return self._processor

    @property
    def model(self):
        return self._model

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def revision(self) -> str:
        return self._revision

    def health(self) -> dict:
        return {
            "status": "ready" if self._loaded else "not_loaded",
            "model_name": settings.model_name.split("/")[-1],
            "model_loaded": self._loaded,
            "model_revision": self._revision,
            "device": settings.device,
        }
