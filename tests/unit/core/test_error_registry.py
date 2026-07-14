from __future__ import annotations

import pytest

# Importing these modules triggers @register_error side effects for the whole registry.
from app.core.errors.custom_errors.data_loading_and_semantics_errors import (  # noqa: F401
    data_loading_errors,
    data_semantics_error,
)
from app.core.errors.error_registry import ERROR_REGISTRY, MetamorphosisError, get_error_class, register_error

ALL_EXPECTED_CODES = [
    "DATA_LOADING_001",
    "DATA_LOADING_002",
    "DATA_LOADING_003",
    "DATA_LOADING_004",
    "DATA_SEMANTICS_001",
    "DATA_SEMANTICS_002",
]


def test_base_error_default_message() -> None:
    error = MetamorphosisError()
    assert error.message == MetamorphosisError.default_message
    assert error.details == {}


def test_base_error_custom_message_and_details() -> None:
    error = MetamorphosisError("custom message", details={"foo": "bar"})
    assert error.message == "custom message"
    assert error.details == {"foo": "bar"}


def test_to_dict_shape() -> None:
    error = MetamorphosisError("boom", details={"x": 1})
    assert error.to_dict() == {
        "error_code": "METAMORPHOSIS_000",
        "error": "MetamorphosisError",
        "message": "boom",
        "details": {"x": 1},
    }


def test_register_error_adds_to_registry() -> None:
    class _TempError(MetamorphosisError):
        error_code = "TEST_TEMP_001"

    register_error(_TempError)

    assert ERROR_REGISTRY["TEST_TEMP_001"] is _TempError
    del ERROR_REGISTRY["TEST_TEMP_001"]


def test_register_error_duplicate_code_raises() -> None:
    class _TempErrorA(MetamorphosisError):
        error_code = "TEST_TEMP_002"

    class _TempErrorB(MetamorphosisError):
        error_code = "TEST_TEMP_002"

    register_error(_TempErrorA)

    try:
        with pytest.raises(ValueError, match="already registered"):
            register_error(_TempErrorB)
    finally:
        del ERROR_REGISTRY["TEST_TEMP_002"]


def test_get_error_class_returns_registered() -> None:
    assert get_error_class("DATA_LOADING_001") is data_loading_errors.MetamorphosisAPIFetchError


def test_get_error_class_unknown_raises() -> None:
    with pytest.raises(KeyError, match="Unknown error code"):
        get_error_class("NOT_A_REAL_CODE")


@pytest.mark.parametrize("code", ALL_EXPECTED_CODES)
def test_all_concrete_errors_registered(code: str) -> None:
    assert code in ERROR_REGISTRY
    assert issubclass(ERROR_REGISTRY[code], MetamorphosisError)
