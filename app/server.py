from __future__ import annotations

from fastapi import FastAPI

from app.core.config.settings import get_settings

app = FastAPI(title="Metamorphosis AI Chief Strategy Officer", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "env": settings.env.value}
