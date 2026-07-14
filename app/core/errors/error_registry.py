from __future__ import annotations

from typing import Any, ClassVar, TypeVar

E = TypeVar("E", bound="MetamorphosisError")


class MetamorphosisError(Exception):
    error_code: ClassVar[str] = "METAMORPHOSIS_000"
    default_message: ClassVar[str] = "An unexpected Metamorphosis service error occurred"

    def __init__(self, message: str | None = None, *, details: dict[str, Any] | None = None) -> None:
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "error_code": self.error_code,
            "error": type(self).__name__,
            "message": self.message,
            "details": self.details,
        }


E = TypeVar("E", bound=MetamorphosisError)

ERROR_REGISTRY: dict[str, type[MetamorphosisError]] = {}


def register_error(cls: type[E]) -> type[E]:
    code = cls.error_code

    if code in ERROR_REGISTRY:
        raise ValueError(f"Error code '{code}' is already registered to {ERROR_REGISTRY[code].__name__}")

    ERROR_REGISTRY[code] = cls

    return cls


def get_error_class(error_code: str) -> type[MetamorphosisError]:
    try:
        return ERROR_REGISTRY[error_code]
    except KeyError as exc:
        known_codes = ", ".join(sorted(ERROR_REGISTRY))
        raise KeyError(f"Unknown error code '{error_code}'. Known codes: {known_codes}") from exc
