from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from app.core.errors.error_registry import MetamorphosisError, register_error


@register_error
class MetamorphosisAPIFetchError(MetamorphosisError):
    error_code = "DATA_LOADING_001"
    default_message = "Unable to fetch data from a Metamorphosis API"

    def __init__(self, api_name: str, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.api_name = api_name
        message = message or f"{self.default_message}: {api_name}"
        super().__init__(message, details={"api_name": api_name, **(details or {})})


@register_error
class DataPreprocessingError(MetamorphosisError):
    error_code = "DATA_LOADING_002"
    default_message = "Data received from the main server does not match the expected shape"

    def __init__(
        self,
        api_name: str,
        message: str | None = None,
        *,
        missing_keys: Sequence[str] | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.api_name = api_name
        self.missing_keys = list(missing_keys) if missing_keys else []
        message = message or f"{self.default_message}: {api_name}"
        super().__init__(
            message,
            details={"api_name": api_name, "missing_keys": self.missing_keys, **(details or {})},
        )


@register_error
class DataFrameCreationError(MetamorphosisError):
    error_code = "DATA_LOADING_003"
    default_message = "Data could not be converted into a structured dataframe"

    def __init__(self, dataframe_name: str, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.dataframe_name = dataframe_name
        message = message or f"{self.default_message}: {dataframe_name}"
        super().__init__(message, details={"dataframe_name": dataframe_name, **(details or {})})


@register_error
class DataFrameEmptyError(MetamorphosisError):
    error_code = "DATA_LOADING_004"
    default_message = "Dataframe is empty"

    def __init__(self, dataframe_name: str, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.dataframe_name = dataframe_name
        message = message or f"{self.default_message}: {dataframe_name}"
        super().__init__(message, details={"dataframe_name": dataframe_name, **(details or {})})
