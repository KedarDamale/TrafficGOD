from __future__ import annotations

import asyncio
from datetime import date
from enum import StrEnum
from typing import Any

import httpx
import pandas as pd

from app.core.cache.memory_cache import build_cache_key, cache_set
from app.core.config.settings import get_settings
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import (
    DataFrameCreationError,
    DataFrameEmptyError,
    DataPreprocessingError,
    MetamorphosisAPIFetchError,
)
from app.services.data_loader_and_semantics.build_semantics_on_loaded_data import build_and_cache_semantics
from app.services.data_loader_and_semantics.clinics import clinic_label
from app.services.data_loader_and_semantics.endpoints import ENDPOINTS, Dataset, EndpointSpec, ParamStyle


class AnalysisScope(StrEnum):
    CLINIC = "clinic"
    ALL_CLINICS = "all_clinics"
    BOTH = "both"


def _validate_dates(start_date: str, end_date: str) -> None:
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError as exc:
        raise ValueError(f"Dates must be in YYYY-MM-DD format: start_date={start_date!r}, end_date={end_date!r}") from exc

    if start > end:
        raise ValueError(f"start_date ({start_date}) must not be after end_date ({end_date})")


def _build_request_kwargs(
    spec: EndpointSpec,
    *,
    start_date: str,
    end_date: str,
    user_map_id: int | None,
    all_clinics: bool,
) -> dict[str, Any]:
    if spec.param_style is ParamStyle.QUERY_SNAKE:
        return {"params": {"user_map_id": user_map_id, "start_date": start_date, "end_date": end_date}}

    body: dict[str, Any] = {"startDate": start_date, "endDate": end_date}

    if all_clinics:
        body["all_clinics"] = True
    else:
        body["user_map_id"] = user_map_id

    return {"json": body}


def _default_timeout() -> httpx.Timeout:
    settings = get_settings()
    return httpx.Timeout(settings.http_timeout_seconds, connect=settings.http_connect_timeout_seconds)


async def _fetch_payload(client: httpx.AsyncClient, spec: EndpointSpec, request_kwargs: dict[str, Any]) -> dict[str, Any]:
    try:
        response = await client.request(spec.method, spec.path, **request_kwargs)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise MetamorphosisAPIFetchError(spec.dataset.value, details={"reason": str(exc)}) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise DataPreprocessingError(spec.dataset.value, "Response body was not valid JSON", details={"reason": str(exc)}) from exc

    if not isinstance(payload, dict):
        raise DataPreprocessingError(spec.dataset.value, f"Expected a JSON object response, got {type(payload).__name__}")

    return payload


def _extract_records(spec: EndpointSpec, payload: dict[str, Any]) -> list[dict[str, Any]]:
    if not payload.get(spec.success_key):
        raise DataPreprocessingError(
            spec.dataset.value,
            f"Response '{spec.success_key}' flag was not truthy",
            missing_keys=[spec.success_key],
        )

    if "data" not in payload:
        raise DataPreprocessingError(spec.dataset.value, "Response is missing the 'data' key", missing_keys=["data"])

    data = payload["data"]

    if spec.records_are_list:
        if not isinstance(data, list):
            raise DataPreprocessingError(spec.dataset.value, f"Expected 'data' to be a list, got {type(data).__name__}")
        return data

    if not isinstance(data, dict):
        raise DataPreprocessingError(spec.dataset.value, f"Expected 'data' to be an object, got {type(data).__name__}")

    return [data]


def _to_dataframe(records: list[dict[str, Any]], dataframe_name: str) -> pd.DataFrame:
    try:
        df = pd.json_normalize(records, sep="_")
    except Exception as exc:
        raise DataFrameCreationError(dataframe_name, details={"reason": str(exc)}) from exc

    if df.empty:
        raise DataFrameEmptyError(dataframe_name)

    return df


async def _fetch_dataset(
    dataset: Dataset,
    *,
    start_date: str,
    end_date: str,
    user_map_id: int | None,
    all_clinics: bool,
    client: httpx.AsyncClient | None = None,
) -> pd.DataFrame:
    _validate_dates(start_date, end_date)

    spec = ENDPOINTS[dataset]
    request_kwargs = _build_request_kwargs(
        spec, start_date=start_date, end_date=end_date, user_map_id=user_map_id, all_clinics=all_clinics
    )

    if client is not None:
        payload = await _fetch_payload(client, spec, request_kwargs)
    else:
        settings = get_settings()
        async with httpx.AsyncClient(base_url=settings.metamorphosis_base_url, timeout=_default_timeout()) as owned_client:
            payload = await _fetch_payload(owned_client, spec, request_kwargs)

    records = _extract_records(spec, payload)
    return _to_dataframe(records, dataset.value)


async def fetch_sales_period(
    user_map_id: int, start_date: str, end_date: str, *, client: httpx.AsyncClient | None = None
) -> pd.DataFrame:
    return await _fetch_dataset(
        Dataset.SALES_PERIOD,
        start_date=start_date,
        end_date=end_date,
        user_map_id=user_map_id,
        all_clinics=False,
        client=client,
    )


def _require_single_scope(user_map_id: int | None, all_clinics: bool) -> None:
    if bool(user_map_id is not None) == bool(all_clinics):
        raise ValueError("Exactly one of 'user_map_id' or 'all_clinics' must be provided")


async def fetch_service_sell(
    start_date: str,
    end_date: str,
    *,
    user_map_id: int | None = None,
    all_clinics: bool = False,
    client: httpx.AsyncClient | None = None,
) -> pd.DataFrame:
    _require_single_scope(user_map_id, all_clinics)
    return await _fetch_dataset(
        Dataset.SERVICE_SELL,
        start_date=start_date,
        end_date=end_date,
        user_map_id=user_map_id,
        all_clinics=all_clinics,
        client=client,
    )


async def fetch_product_sell(
    start_date: str,
    end_date: str,
    *,
    user_map_id: int | None = None,
    all_clinics: bool = False,
    client: httpx.AsyncClient | None = None,
) -> pd.DataFrame:
    _require_single_scope(user_map_id, all_clinics)
    return await _fetch_dataset(
        Dataset.PRODUCT_SELL,
        start_date=start_date,
        end_date=end_date,
        user_map_id=user_map_id,
        all_clinics=all_clinics,
        client=client,
    )


async def _fetch_and_cache(
    client: httpx.AsyncClient,
    dataset: Dataset,
    scope_label: str,
    *,
    start_date: str,
    end_date: str,
    user_map_id: int | None,
    all_clinics: bool,
    build_semantics: bool,
) -> dict[str, Any]:
    df = await _fetch_dataset(
        dataset,
        start_date=start_date,
        end_date=end_date,
        user_map_id=user_map_id,
        all_clinics=all_clinics,
        client=client,
    )

    cache_key = build_cache_key(
        dataset.value, start_date=start_date, end_date=end_date, user_map_id=user_map_id, all_clinics=all_clinics
    )
    cache_set(cache_key, df)

    semantics_key: str | None = None
    if build_semantics:
        semantics_key = build_and_cache_semantics(cache_key)

    return {
        "dataset": dataset.value,
        "scope": scope_label,
        "clinic": clinic_label(user_map_id) if scope_label == "clinic" else None,
        "cache_key": cache_key,
        "semantics_key": semantics_key,
        "row_count": len(df),
    }


async def load_all_data(
    user_map_id: int,
    start_date: str,
    end_date: str,
    *,
    analysis_scope: AnalysisScope = AnalysisScope.CLINIC,
    build_semantics: bool = True,
) -> dict[str, Any]:
    """Fetch sales_period plus service_sell/product_sell for the requested scope(s), caching each dataframe.

    asyncio.gather is fail-fast: if one fetch raises, siblings that already completed have already been
    cached (each task caches its own result before returning), so a single upstream failure does not
    discard data siblings already fetched successfully.
    """
    _validate_dates(start_date, end_date)
    settings = get_settings()

    jobs: list[tuple[Dataset, str, int | None, bool]] = [
        (Dataset.SALES_PERIOD, "clinic", user_map_id, False),
    ]

    if analysis_scope in (AnalysisScope.CLINIC, AnalysisScope.BOTH):
        jobs.append((Dataset.SERVICE_SELL, "clinic", user_map_id, False))
        jobs.append((Dataset.PRODUCT_SELL, "clinic", user_map_id, False))

    if analysis_scope in (AnalysisScope.ALL_CLINICS, AnalysisScope.BOTH):
        jobs.append((Dataset.SERVICE_SELL, "all_clinics", None, True))
        jobs.append((Dataset.PRODUCT_SELL, "all_clinics", None, True))

    async with httpx.AsyncClient(base_url=settings.metamorphosis_base_url, timeout=_default_timeout()) as client:
        entries = await asyncio.gather(
            *[
                _fetch_and_cache(
                    client,
                    dataset,
                    scope_label,
                    start_date=start_date,
                    end_date=end_date,
                    user_map_id=job_user_map_id,
                    all_clinics=all_clinics,
                    build_semantics=build_semantics,
                )
                for dataset, scope_label, job_user_map_id, all_clinics in jobs
            ]
        )

    return {"message": "Data stored successfully", "entries": list(entries)}
