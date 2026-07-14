from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
import respx

from app.core.cache.memory_cache import cache_get
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import (
    DataFrameCreationError,
    DataFrameEmptyError,
    DataPreprocessingError,
    MetamorphosisAPIFetchError,
)
from app.services.data_loader_and_semantics import load_data
from app.services.data_loader_and_semantics.endpoints import ENDPOINTS, Dataset
from app.services.data_loader_and_semantics.load_data import AnalysisScope

pytestmark = pytest.mark.anyio


# --------------------------------------------------------------------------
# _validate_dates
# --------------------------------------------------------------------------


def test_validate_dates_accepts_iso() -> None:
    load_data._validate_dates("2026-04-01", "2026-04-30")


def test_validate_dates_rejects_bad_format() -> None:
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        load_data._validate_dates("04/01/2026", "2026-04-30")


def test_validate_dates_rejects_reversed_range() -> None:
    with pytest.raises(ValueError, match="must not be after"):
        load_data._validate_dates("2026-04-30", "2026-04-01")


# --------------------------------------------------------------------------
# _build_request_kwargs
# --------------------------------------------------------------------------


def test_sales_period_query_params_snake_case() -> None:
    spec = ENDPOINTS[Dataset.SALES_PERIOD]
    kwargs = load_data._build_request_kwargs(
        spec, start_date="2026-04-01", end_date="2026-04-30", user_map_id=70697, all_clinics=False
    )
    assert kwargs == {"params": {"user_map_id": 70697, "start_date": "2026-04-01", "end_date": "2026-04-30"}}


def test_service_sell_body_camelcase_dates() -> None:
    spec = ENDPOINTS[Dataset.SERVICE_SELL]
    kwargs = load_data._build_request_kwargs(
        spec, start_date="2026-04-01", end_date="2026-04-30", user_map_id=70697, all_clinics=False
    )
    assert kwargs == {"json": {"startDate": "2026-04-01", "endDate": "2026-04-30", "user_map_id": 70697}}


def test_all_clinics_body_omits_user_map_id() -> None:
    spec = ENDPOINTS[Dataset.PRODUCT_SELL]
    kwargs = load_data._build_request_kwargs(
        spec, start_date="2026-04-01", end_date="2026-04-30", user_map_id=None, all_clinics=True
    )
    assert kwargs == {"json": {"startDate": "2026-04-01", "endDate": "2026-04-30", "all_clinics": True}}
    assert "user_map_id" not in kwargs["json"]


# --------------------------------------------------------------------------
# _fetch_payload
# --------------------------------------------------------------------------


async def test_fetch_payload_success_get(mock_api: respx.MockRouter, sales_period_payload: dict) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        payload = await load_data._fetch_payload(
            client, ENDPOINTS[Dataset.SALES_PERIOD], {"params": {"user_map_id": 70697}}
        )

    assert payload["success"] is True


async def test_fetch_payload_success_post(mock_api: respx.MockRouter, service_sell_payload: Callable[..., dict]) -> None:
    mock_api.post("/api/analysis/service-sell").mock(return_value=httpx.Response(200, json=service_sell_payload()))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        payload = await load_data._fetch_payload(client, ENDPOINTS[Dataset.SERVICE_SELL], {"json": {}})

    assert payload["status"] is True


async def test_fetch_payload_http_500_raises_api_fetch_error_with_api_name(mock_api: respx.MockRouter) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(500, json={"error": "boom"}))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        with pytest.raises(MetamorphosisAPIFetchError) as exc_info:
            await load_data._fetch_payload(client, ENDPOINTS[Dataset.SALES_PERIOD], {"params": {}})

    assert exc_info.value.api_name == "sales_period"


async def test_fetch_payload_timeout_raises_api_fetch_error(mock_api: respx.MockRouter) -> None:
    mock_api.get("/api/billing/sales-period").mock(side_effect=httpx.ConnectTimeout("timed out"))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        with pytest.raises(MetamorphosisAPIFetchError) as exc_info:
            await load_data._fetch_payload(client, ENDPOINTS[Dataset.SALES_PERIOD], {"params": {}})

    assert exc_info.value.api_name == "sales_period"


async def test_fetch_payload_network_error_raises_api_fetch_error(mock_api: respx.MockRouter) -> None:
    mock_api.post("/api/analysis/product-sell").mock(side_effect=httpx.ConnectError("network down"))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        with pytest.raises(MetamorphosisAPIFetchError) as exc_info:
            await load_data._fetch_payload(client, ENDPOINTS[Dataset.PRODUCT_SELL], {"json": {}})

    assert exc_info.value.api_name == "product_sell"


async def test_fetch_payload_non_json_response_raises_preprocessing_error(mock_api: respx.MockRouter) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, text="not json"))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        with pytest.raises(DataPreprocessingError) as exc_info:
            await load_data._fetch_payload(client, ENDPOINTS[Dataset.SALES_PERIOD], {"params": {}})

    assert exc_info.value.api_name == "sales_period"


async def test_fetch_payload_non_dict_json_response_raises_preprocessing_error(mock_api: respx.MockRouter) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=[1, 2, 3]))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        with pytest.raises(DataPreprocessingError) as exc_info:
            await load_data._fetch_payload(client, ENDPOINTS[Dataset.SALES_PERIOD], {"params": {}})

    assert exc_info.value.api_name == "sales_period"


# --------------------------------------------------------------------------
# _extract_records
# --------------------------------------------------------------------------


def test_extract_records_list_data(sales_period_payload: dict) -> None:
    records = load_data._extract_records(ENDPOINTS[Dataset.SALES_PERIOD], sales_period_payload)
    assert records == sales_period_payload["data"]


def test_extract_records_dict_data_wrapped_to_single_row_list(service_sell_payload: Callable[..., dict]) -> None:
    payload = service_sell_payload()
    records = load_data._extract_records(ENDPOINTS[Dataset.SERVICE_SELL], payload)
    assert records == [payload["data"]]


def test_extract_records_missing_data_key_raises() -> None:
    with pytest.raises(DataPreprocessingError, match="data"):
        load_data._extract_records(ENDPOINTS[Dataset.SALES_PERIOD], {"success": True})


def test_extract_records_success_flag_false_raises() -> None:
    with pytest.raises(DataPreprocessingError):
        load_data._extract_records(ENDPOINTS[Dataset.SALES_PERIOD], {"success": False, "data": []})


def test_extract_records_wrong_data_type_raises() -> None:
    with pytest.raises(DataPreprocessingError):
        load_data._extract_records(ENDPOINTS[Dataset.SALES_PERIOD], {"success": True, "data": {"not": "a list"}})

    with pytest.raises(DataPreprocessingError):
        load_data._extract_records(ENDPOINTS[Dataset.SERVICE_SELL], {"status": True, "data": [1, 2, 3]})


# --------------------------------------------------------------------------
# _to_dataframe
# --------------------------------------------------------------------------


def test_flattens_nested_keys_with_underscore(sales_period_payload: dict) -> None:
    df = load_data._to_dataframe(sales_period_payload["data"], "sales_period")

    for column in ("sale_amount", "patient_patient_name", "cancellation_is_cancel"):
        assert column in df.columns


def test_single_dict_record_yields_one_row(service_sell_payload: Callable[..., dict]) -> None:
    payload = service_sell_payload()
    df = load_data._to_dataframe([payload["data"]], "service_sell")
    assert len(df) == 1


def test_empty_records_raise_dataframe_empty_error_with_name() -> None:
    with pytest.raises(DataFrameEmptyError) as exc_info:
        load_data._to_dataframe([], "sales_period")

    assert exc_info.value.dataframe_name == "sales_period"


def test_normalize_failure_raises_dataframe_creation_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("normalize exploded")

    monkeypatch.setattr(load_data.pd, "json_normalize", _raise)

    with pytest.raises(DataFrameCreationError) as exc_info:
        load_data._to_dataframe([{"a": 1}], "sales_period")

    assert exc_info.value.dataframe_name == "sales_period"


# --------------------------------------------------------------------------
# Public fetchers
# --------------------------------------------------------------------------


async def test_fetch_sales_period_returns_flattened_dataframe(mock_api: respx.MockRouter, sales_period_payload: dict) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        df = await load_data.fetch_sales_period(70697, "2026-04-01", "2026-04-30", client=client)

    assert len(df) == 2
    assert "sale_amount" in df.columns


async def test_fetch_sales_period_creates_own_client_when_none_provided(
    mock_api: respx.MockRouter, sales_period_payload: dict
) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))

    df = await load_data.fetch_sales_period(70697, "2026-04-01", "2026-04-30")

    assert len(df) == 2


async def test_fetch_service_sell_clinic_scope_sends_user_map_id(
    mock_api: respx.MockRouter, service_sell_payload: Callable[..., dict]
) -> None:
    route = mock_api.post("/api/analysis/service-sell").mock(return_value=httpx.Response(200, json=service_sell_payload()))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        await load_data.fetch_service_sell("2026-04-01", "2026-04-30", user_map_id=70697, client=client)

    sent_body = json.loads(route.calls.last.request.content)
    assert sent_body["user_map_id"] == 70697
    assert "all_clinics" not in sent_body


async def test_fetch_service_sell_all_clinics_sends_flag(
    mock_api: respx.MockRouter, service_sell_payload: Callable[..., dict]
) -> None:
    route = mock_api.post("/api/analysis/service-sell").mock(
        return_value=httpx.Response(200, json=service_sell_payload(all_clinics=True))
    )

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        await load_data.fetch_service_sell("2026-04-01", "2026-04-30", all_clinics=True, client=client)

    sent_body = json.loads(route.calls.last.request.content)
    assert sent_body["all_clinics"] is True
    assert "user_map_id" not in sent_body


async def test_fetch_service_sell_requires_exactly_one_scope() -> None:
    with pytest.raises(ValueError, match="Exactly one"):
        await load_data.fetch_service_sell("2026-04-01", "2026-04-30")


async def test_fetch_product_sell_returns_one_row_dataframe(
    mock_api: respx.MockRouter, product_sell_payload: Callable[..., dict]
) -> None:
    mock_api.post("/api/analysis/product-sell").mock(return_value=httpx.Response(200, json=product_sell_payload()))

    async with httpx.AsyncClient(base_url="https://metamorphosis.youv.ai") as client:
        df = await load_data.fetch_product_sell("2026-04-01", "2026-04-30", user_map_id=70697, client=client)

    assert len(df) == 1
    assert "revenue" in df.columns


# --------------------------------------------------------------------------
# load_all_data orchestrator
# --------------------------------------------------------------------------


def _mock_all_endpoints(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))

    def _service_sell(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        return httpx.Response(200, json=service_sell_payload(all_clinics=bool(body.get("all_clinics"))))

    def _product_sell(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        return httpx.Response(200, json=product_sell_payload(all_clinics=bool(body.get("all_clinics"))))

    mock_api.post("/api/analysis/service-sell").mock(side_effect=_service_sell)
    mock_api.post("/api/analysis/product-sell").mock(side_effect=_product_sell)


async def test_load_all_data_stores_three_dataframes_under_expected_keys(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_data.load_all_data(70697, "2026-04-01", "2026-04-30", build_semantics=False)

    expected_keys = {
        "sales_period:clinic:70697:2026-04-01:2026-04-30",
        "service_sell:clinic:70697:2026-04-01:2026-04-30",
        "product_sell:clinic:70697:2026-04-01:2026-04-30",
    }
    actual_keys = {entry["cache_key"] for entry in result["entries"]}
    assert actual_keys == expected_keys

    for key in expected_keys:
        assert cache_get(key) is not None


async def test_load_all_data_manifest_message_and_keys(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_data.load_all_data(70697, "2026-04-01", "2026-04-30", build_semantics=False)

    assert result["message"] == "Data stored successfully"
    assert len(result["entries"]) == 3
    for entry in result["entries"]:
        assert entry["clinic"] == "GK"
        assert entry["semantics_key"] is None


async def test_load_all_data_both_scope_yields_five_entries(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_data.load_all_data(
        70697, "2026-04-01", "2026-04-30", analysis_scope=AnalysisScope.BOTH, build_semantics=False
    )

    assert len(result["entries"]) == 5
    scopes = {(entry["dataset"], entry["scope"]) for entry in result["entries"]}
    assert scopes == {
        ("sales_period", "clinic"),
        ("service_sell", "clinic"),
        ("product_sell", "clinic"),
        ("service_sell", "all_clinics"),
        ("product_sell", "all_clinics"),
    }


async def test_load_all_data_builds_and_caches_semantics_by_default(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_data.load_all_data(70697, "2026-04-01", "2026-04-30")

    for entry in result["entries"]:
        assert entry["semantics_key"] is not None
        assert cache_get(entry["semantics_key"]) is not None


async def test_load_all_data_skips_semantics_when_disabled(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_data.load_all_data(70697, "2026-04-01", "2026-04-30", build_semantics=False)

    assert all(entry["semantics_key"] is None for entry in result["entries"])


async def test_load_all_data_propagates_fetch_error_with_api_name(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))
    mock_api.post("/api/analysis/service-sell").mock(return_value=httpx.Response(200, json=service_sell_payload()))
    mock_api.post("/api/analysis/product-sell").mock(return_value=httpx.Response(500, json={"error": "boom"}))

    with pytest.raises(MetamorphosisAPIFetchError) as exc_info:
        await load_data.load_all_data(70697, "2026-04-01", "2026-04-30", build_semantics=False)

    assert exc_info.value.api_name == "product_sell"


async def test_load_all_data_invalid_dates_raise_before_any_http_call(mock_api: respx.MockRouter) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json={}))
    mock_api.post("/api/analysis/service-sell").mock(return_value=httpx.Response(200, json={}))
    mock_api.post("/api/analysis/product-sell").mock(return_value=httpx.Response(200, json={}))

    with pytest.raises(ValueError, match="must not be after"):
        await load_data.load_all_data(70697, "2026-04-30", "2026-04-01")

    assert len(mock_api.calls) == 0
