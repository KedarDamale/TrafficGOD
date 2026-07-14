from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from app.core.cache.memory_cache import cache_get, cache_set
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import DataFrameEmptyError
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_semantics_error import (
    CachedDataNotFoundError,
    SemanticsBuildError,
)
from app.services.data_loader_and_semantics import build_semantics_on_loaded_data as semantics_module
from app.services.data_loader_and_semantics.build_semantics_on_loaded_data import (
    _json_safe,
    _semantic_type,
    _try_parse_datetime,
    build_and_cache_semantics,
    build_semantics,
)


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "amount": [100, 200, 300, None],
            "created_at": ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"],
            "is_cancel": [True, False, True, False],
            "status": ["success", "success", "failed", "success"],
            "patient_name": ["alice", "bob", "carol", "dave"],
        }
    )


def test_dataset_level_fields() -> None:
    result = build_semantics(_sample_df(), "test_dataset")

    assert result["dataset_name"] == "test_dataset"
    assert result["row_count"] == 4
    assert result["column_count"] == 5
    assert "generated_at" in result
    assert set(result["columns"]) == {"amount", "created_at", "is_cancel", "status", "patient_name"}


def test_numeric_column_min_max_mean() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    amount = result["columns"]["amount"]

    assert amount["semantic_type"] == "numeric"
    assert amount["min"] == 100
    assert amount["max"] == 300
    assert amount["mean"] == 200.0


def test_datetime_string_column_detected_with_iso_range() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    created_at = result["columns"]["created_at"]

    assert created_at["semantic_type"] == "datetime"
    assert created_at["min"].startswith("2026-04-01")
    assert created_at["max"].startswith("2026-04-04")


def test_boolean_column_top_values() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    is_cancel = result["columns"]["is_cancel"]

    assert is_cancel["semantic_type"] == "boolean"
    values = {entry["value"] for entry in is_cancel["top_values"]}
    assert values == {True, False}
    for entry in is_cancel["top_values"]:
        assert isinstance(entry["value"], bool)
        assert not isinstance(entry["value"], np.generic)


def test_categorical_column_top_values_limited() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    status = result["columns"]["status"]

    assert status["semantic_type"] == "categorical"
    top_values = {entry["value"]: entry["count"] for entry in status["top_values"]}
    assert top_values == {"success": 3, "failed": 1}


def test_text_column_high_cardinality_not_categorical() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    patient_name = result["columns"]["patient_name"]

    assert patient_name["semantic_type"] == "text"
    assert "top_values" not in patient_name


def test_null_and_unique_counts() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    amount = result["columns"]["amount"]

    assert amount["null_count"] == 1
    assert amount["null_percent"] == 25.0
    assert amount["unique_count"] == 3


def test_sample_values_json_safe_and_limited() -> None:
    df = pd.DataFrame({"n": list(range(7))})
    result = build_semantics(df, "wide_dataset")
    sample_values = result["columns"]["n"]["sample_values"]

    assert len(sample_values) == 5
    for value in sample_values:
        assert not isinstance(value, np.generic)


def test_output_json_serializable() -> None:
    result = build_semantics(_sample_df(), "test_dataset")
    json.dumps(result)


def test_empty_dataframe_raises_dataframe_empty_error() -> None:
    with pytest.raises(DataFrameEmptyError) as exc_info:
        build_semantics(pd.DataFrame(), "empty_dataset")

    assert exc_info.value.dataframe_name == "empty_dataset"


def test_unexpected_failure_wrapped_in_semantics_build_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("column semantics exploded")

    monkeypatch.setattr(semantics_module, "_column_semantics", _raise)

    with pytest.raises(SemanticsBuildError) as exc_info:
        build_semantics(_sample_df(), "test_dataset")

    assert exc_info.value.dataset_name == "test_dataset"


def test_build_and_cache_semantics_stores_under_semantics_key() -> None:
    cache_set("my_key", _sample_df())

    semantics_key = build_and_cache_semantics("my_key")

    assert semantics_key == "semantics:my_key"
    cached = cache_get(semantics_key)
    assert cached is not None
    assert cached["row_count"] == 4


def test_build_and_cache_semantics_missing_key_raises_cached_data_not_found() -> None:
    with pytest.raises(CachedDataNotFoundError) as exc_info:
        build_and_cache_semantics("does_not_exist")

    assert exc_info.value.cache_key == "does_not_exist"


def test_json_safe_handles_raw_nan_and_numpy_scalars() -> None:
    assert _json_safe(float("nan")) is None
    assert _json_safe(pd.NaT) is None
    assert _json_safe(np.int64(5)) == 5
    assert not isinstance(_json_safe(np.int64(5)), np.generic)
    assert _json_safe("plain") == "plain"


def test_try_parse_datetime_all_null_returns_none() -> None:
    series = pd.Series([None, None, None], dtype="object")
    assert _try_parse_datetime(series) is None


def test_semantic_type_native_datetime64_dtype() -> None:
    series = pd.to_datetime(pd.Series(["2026-04-01", "2026-04-02"]))
    assert _semantic_type(series) == "datetime"


def test_semantic_type_all_null_string_column_is_unknown() -> None:
    series = pd.Series([None, None], dtype="str")
    assert _semantic_type(series) == "unknown"


def test_all_null_column_semantics_has_no_min_max() -> None:
    df = pd.DataFrame({"empty_col": pd.Series([None, None], dtype="str"), "anchor": [1, 2]})
    result = build_semantics(df, "test_dataset")
    empty_col = result["columns"]["empty_col"]

    assert empty_col["semantic_type"] == "unknown"
    assert "min" not in empty_col
    assert empty_col["null_count"] == 2
