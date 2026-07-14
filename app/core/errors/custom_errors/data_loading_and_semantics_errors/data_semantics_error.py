from __future__ import annotations

from typing import Any

from app.core.errors.error_registry import MetamorphosisError, register_error


@register_error
class CachedDataNotFoundError(MetamorphosisError):
    error_code = "DATA_SEMANTICS_001"
    default_message = "No cached data was found for the requested cache key"

    def __init__(self, cache_key: str, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.cache_key = cache_key
        message = message or f"{self.default_message}: {cache_key}"
        super().__init__(message, details={"cache_key": cache_key, **(details or {})})


@register_error
class SemanticsBuildError(MetamorphosisError):
    error_code = "DATA_SEMANTICS_002"
    default_message = "Failed to build semantics metadata for a dataset"

    def __init__(self, dataset_name: str, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.dataset_name = dataset_name
        message = message or f"{self.default_message}: {dataset_name}"
        super().__init__(message, details={"dataset_name": dataset_name, **(details or {})})
