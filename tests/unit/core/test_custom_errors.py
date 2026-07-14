from __future__ import annotations

from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import (
    DataFrameCreationError,
    DataFrameEmptyError,
    DataPreprocessingError,
    MetamorphosisAPIFetchError,
)
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_semantics_error import (
    CachedDataNotFoundError,
    SemanticsBuildError,
)
from app.core.errors.error_registry import ERROR_REGISTRY


def test_api_fetch_error_carries_api_name() -> None:
    error = MetamorphosisAPIFetchError("sales_period")
    assert error.api_name == "sales_period"
    assert error.details["api_name"] == "sales_period"
    assert "sales_period" in error.message


def test_preprocessing_error_details_include_missing_keys() -> None:
    error = DataPreprocessingError("service_sell", missing_keys=["data", "status"])
    assert error.missing_keys == ["data", "status"]
    assert error.details["missing_keys"] == ["data", "status"]
    assert error.api_name == "service_sell"


def test_dataframe_creation_error_carries_dataframe_name() -> None:
    error = DataFrameCreationError("product_sell")
    assert error.dataframe_name == "product_sell"
    assert "product_sell" in error.message


def test_dataframe_empty_error_carries_dataframe_name() -> None:
    error = DataFrameEmptyError("sales_period")
    assert error.dataframe_name == "sales_period"
    assert error.details["dataframe_name"] == "sales_period"


def test_cached_data_not_found_carries_cache_key() -> None:
    error = CachedDataNotFoundError("sales_period:clinic:70697:2026-04-01:2026-04-30")
    assert error.cache_key == "sales_period:clinic:70697:2026-04-01:2026-04-30"


def test_semantics_build_error_carries_dataset_name() -> None:
    error = SemanticsBuildError("sales_period")
    assert error.dataset_name == "sales_period"


def test_error_codes_unique() -> None:
    codes = [
        MetamorphosisAPIFetchError.error_code,
        DataPreprocessingError.error_code,
        DataFrameCreationError.error_code,
        DataFrameEmptyError.error_code,
        CachedDataNotFoundError.error_code,
        SemanticsBuildError.error_code,
    ]
    assert len(codes) == len(set(codes))
    assert all(code in ERROR_REGISTRY for code in codes)
