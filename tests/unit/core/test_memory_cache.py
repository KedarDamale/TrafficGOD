from __future__ import annotations

import pytest

from app.core.cache.memory_cache import (
    _build_cache,
    build_cache_key,
    cache_get,
    cache_has,
    cache_set,
    get_cache,
    reset_cache,
    semantics_key_for,
)


def test_build_cache_key_clinic_scope() -> None:
    key = build_cache_key("sales_period", start_date="2026-04-01", end_date="2026-04-30", user_map_id=70697)
    assert key == "sales_period:clinic:70697:2026-04-01:2026-04-30"


def test_build_cache_key_all_clinics_scope() -> None:
    key = build_cache_key("service_sell", start_date="2026-04-01", end_date="2026-04-30", all_clinics=True)
    assert key == "service_sell:all_clinics:2026-04-01:2026-04-30"


def test_build_cache_key_requires_exactly_one_scope_neither() -> None:
    with pytest.raises(ValueError, match="Exactly one"):
        build_cache_key("sales_period", start_date="2026-04-01", end_date="2026-04-30")


def test_build_cache_key_requires_exactly_one_scope_both() -> None:
    with pytest.raises(ValueError, match="Exactly one"):
        build_cache_key("sales_period", start_date="2026-04-01", end_date="2026-04-30", user_map_id=1, all_clinics=True)


def test_semantics_key_prefix() -> None:
    assert semantics_key_for("sales_period:clinic:70697:2026-04-01:2026-04-30") == "semantics:sales_period:clinic:70697:2026-04-01:2026-04-30"


def test_cache_set_returns_key_and_get_roundtrip() -> None:
    returned_key = cache_set("some_key", {"a": 1})
    assert returned_key == "some_key"
    assert cache_get("some_key") == {"a": 1}


def test_cache_get_missing_returns_none() -> None:
    assert cache_get("does_not_exist") is None


def test_cache_has() -> None:
    assert cache_has("present") is False
    cache_set("present", 1)
    assert cache_has("present") is True


def test_ttl_expiry_with_fake_timer() -> None:
    current_time = [0.0]
    cache = _build_cache(maxsize=10, ttl=5, timer=lambda: current_time[0])

    cache["a"] = 1
    assert "a" in cache

    current_time[0] = 10.0
    assert "a" not in cache


def test_maxsize_eviction() -> None:
    cache = _build_cache(maxsize=2, ttl=100)

    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    assert len(cache) == 2
    assert "a" not in cache


def test_reset_cache_creates_new_instance() -> None:
    first = get_cache()
    reset_cache()
    second = get_cache()

    assert first is not second
