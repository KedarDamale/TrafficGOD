from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI

from app.core.config.settings import get_settings

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


app = FastAPI(title="Metamorphosis AI Chief Strategy Officer", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "env": settings.env.value}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=9000)
