from __future__ import annotations

from fastapi.testclient import TestClient

from app.server import app


def test_health_returns_ok_and_env() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["env"] == "local"
