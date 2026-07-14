from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd

from app.core.cache.memory_cache import cache_get, cache_set, semantics_key_for
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import DataFrameEmptyError
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_semantics_error import (
    CachedDataNotFoundError,
    SemanticsBuildError,
)

SAMPLE_VALUES_LIMIT = 5
TOP_VALUES_LIMIT = 5
DATETIME_PARSE_RATIO_THRESHOLD = 0.9
CATEGORICAL_MAX_UNIQUE = 20


def _json_safe(value: Any) -> Any:
    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()

    if pd.isna(value):
        return None

    return value


def _try_parse_datetime(series: pd.Series) -> pd.Series | None:
    non_null = series.dropna()

    if non_null.empty:
        return None

    parsed = pd.to_datetime(series, errors="coerce", format="mixed")
    parsed_non_null_count = parsed.notna().sum() - series.isna().sum()

    if (parsed_non_null_count / len(non_null)) >= DATETIME_PARSE_RATIO_THRESHOLD:
        return parsed

    return None


def _semantic_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    if pd.api.types.is_string_dtype(series):
        non_null = series.dropna()

        if non_null.empty:
            return "unknown"

        if _try_parse_datetime(series) is not None:
            return "datetime"

        unique_count = series.nunique(dropna=True)
        if unique_count <= min(CATEGORICAL_MAX_UNIQUE, max(1, 0.5 * len(non_null))):
            return "categorical"

        return "text"

    return "unknown"


def _sample_values(series: pd.Series, limit: int = SAMPLE_VALUES_LIMIT) -> list[Any]:
    return [_json_safe(value) for value in series.dropna().head(limit).tolist()]


def _top_values(series: pd.Series, limit: int = TOP_VALUES_LIMIT) -> list[dict[str, Any]]:
    counts = series.value_counts(dropna=True).head(limit)
    return [{"value": _json_safe(value), "count": int(count)} for value, count in counts.items()]


def _column_semantics(series: pd.Series) -> dict[str, Any]:
    total = len(series)
    null_count = int(series.isna().sum())
    non_null_count = total - null_count
    semantic_type = _semantic_type(series)

    info: dict[str, Any] = {
        "dtype": str(series.dtype),
        "semantic_type": semantic_type,
        "null_count": null_count,
        "null_percent": round((null_count / total) * 100, 2) if total else 0.0,
        "unique_count": int(series.nunique(dropna=True)),
        "sample_values": _sample_values(series),
    }

    if semantic_type == "numeric" and non_null_count:
        numeric_series = pd.to_numeric(series, errors="coerce")
        info["min"] = _json_safe(numeric_series.min())
        info["max"] = _json_safe(numeric_series.max())
        info["mean"] = _json_safe(numeric_series.mean())
    elif semantic_type == "datetime" and non_null_count:
        parsed = series if pd.api.types.is_datetime64_any_dtype(series) else _try_parse_datetime(series)
        if parsed is not None:
            info["min"] = _json_safe(parsed.min())
            info["max"] = _json_safe(parsed.max())
    elif semantic_type in ("categorical", "boolean"):
        info["top_values"] = _top_values(series)

    return info


def build_semantics(df: pd.DataFrame, dataset_name: str) -> dict[str, Any]:
    if df.empty:
        raise DataFrameEmptyError(dataset_name)

    try:
        columns = {column: _column_semantics(df[column]) for column in df.columns}
    except Exception as exc:
        raise SemanticsBuildError(dataset_name, details={"reason": str(exc)}) from exc

    return {
        "dataset_name": dataset_name,
        "generated_at": datetime.now(UTC).isoformat(),
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": columns,
    }


def build_and_cache_semantics(data_cache_key: str) -> str:
    df = cache_get(data_cache_key)

    if df is None:
        raise CachedDataNotFoundError(data_cache_key)

    semantics = build_semantics(df, data_cache_key)
    semantics_key = semantics_key_for(data_cache_key)
    cache_set(semantics_key, semantics)

    return semantics_key
