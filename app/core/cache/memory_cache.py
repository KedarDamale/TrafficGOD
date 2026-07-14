from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

from cachetools import TTLCache

from app.core.config.settings import get_settings

_cache: TTLCache | None = None


def _build_cache(maxsize: int, ttl: float, timer: Callable[[], float] = time.monotonic) -> TTLCache:
    return TTLCache(maxsize=maxsize, ttl=ttl, timer=timer)


def get_cache() -> TTLCache:
    global _cache

    if _cache is None:
        settings = get_settings()
        _cache = _build_cache(maxsize=settings.cache_maxsize, ttl=settings.cache_ttl_seconds)

    return _cache


def reset_cache() -> None:
    global _cache
    _cache = None


def build_cache_key(
    dataset: str,
    *,
    start_date: str,
    end_date: str,
    user_map_id: int | None = None,
    all_clinics: bool = False,
) -> str:
    if bool(user_map_id is not None) == bool(all_clinics):
        raise ValueError("Exactly one of 'user_map_id' or 'all_clinics' must be provided")

    if all_clinics:
        return f"{dataset}:all_clinics:{start_date}:{end_date}"

    return f"{dataset}:clinic:{user_map_id}:{start_date}:{end_date}"


def semantics_key_for(data_cache_key: str) -> str:
    return f"semantics:{data_cache_key}"


def cache_set(key: str, value: Any) -> str:
    get_cache()[key] = value
    return key


def cache_get(key: str) -> Any | None:
    return get_cache().get(key)


def cache_has(key: str) -> bool:
    return key in get_cache()
