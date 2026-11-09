"""
Integration test: POST /analyze with a sample image.
Requires the model to be loaded (slow on first run — downloads ~460 MB).
Skip if the model has not been downloaded yet.
"""
import sys, os, io, pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from PIL import Image
from fastapi.testclient import TestClient
from config import settings


@pytest.fixture(scope="module")
def client():
    from app import app
    return TestClient(app)


@pytest.mark.skipif(
    not os.getenv("RUN_INFERENCE_TESTS"),
    reason="Set RUN_INFERENCE_TESTS=1 to run inference tests (requires model download)",
)
def test_analyze_returns_caption(client):
    # Create a tiny synthetic image
    img = Image.new("RGB", (64, 64), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    r = client.post(
        "/analyze",
        headers={"Authorization": f"Bearer {settings.florence2_secret}"},
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"tasks": "caption"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["caption"], str)
    assert len(body["caption"]) > 0


def test_analyze_rejects_bad_token(client):
    img = Image.new("RGB", (8, 8), color=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    r = client.post(
        "/analyze",
        headers={"Authorization": "Bearer wrong_token"},
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"tasks": "caption"},
    )
    assert r.status_code == 401
