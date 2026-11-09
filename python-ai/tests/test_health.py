"""
Smoke test: health endpoint returns expected schema.
Run WITHOUT loading the model (model.loaded will be False).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient


def test_health_schema():
    # Import app after sys.path is patched
    from app import app
    client = TestClient(app, raise_server_exceptions=False)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "status" in body
    assert "model_name" in body
    assert "model_loaded" in body
