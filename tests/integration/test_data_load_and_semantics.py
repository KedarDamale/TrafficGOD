from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
import respx

from app.core.cache.memory_cache import cache_get
from app.core.errors.custom_errors.data_loading_and_semantics_errors.data_loading_errors import MetamorphosisAPIFetchError
from app.services.data_loader_and_semantics.load_data import AnalysisScope, load_all_data

pytestmark = pytest.mark.anyio


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


async def test_full_pipeline_load_cache_semantics(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_all_data(
        70697, "2026-04-01", "2026-04-30", analysis_scope=AnalysisScope.BOTH, build_semantics=True
    )

    assert result["message"] == "Data stored successfully"
    assert len(result["entries"]) == 5

    for entry in result["entries"]:
        df = cache_get(entry["cache_key"])
        assert df is not None
        assert len(df) == entry["row_count"]

        if entry["dataset"] == "sales_period":
            for column in ("sale_amount", "patient_patient_name", "cancellation_is_cancel"):
                assert column in df.columns

        semantics = cache_get(entry["semantics_key"])
        assert semantics is not None
        assert semantics["row_count"] == len(df)
        assert semantics["column_count"] == len(df.columns)
        json.dumps(semantics)  # must be JSON-serializable for LLM consumption


async def test_pipeline_all_clinics_scope_end_to_end(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
) -> None:
    _mock_all_endpoints(mock_api, sales_period_payload, service_sell_payload, product_sell_payload)

    result = await load_all_data(
        70697, "2026-04-01", "2026-04-30", analysis_scope=AnalysisScope.ALL_CLINICS, build_semantics=False
    )

    all_clinics_entries = [entry for entry in result["entries"] if entry["scope"] == "all_clinics"]
    assert len(all_clinics_entries) == 2

    for entry in all_clinics_entries:
        assert entry["clinic"] is None
        assert entry["cache_key"] == f"{entry['dataset']}:all_clinics:2026-04-01:2026-04-30"
        df = cache_get(entry["cache_key"])
        assert df.iloc[0]["scope"] == "all_clinics"


async def test_pipeline_upstream_failure_carries_api_name(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
) -> None:
    mock_api.get("/api/billing/sales-period").mock(return_value=httpx.Response(200, json=sales_period_payload))
    mock_api.post("/api/analysis/service-sell").mock(return_value=httpx.Response(200, json=service_sell_payload()))
    mock_api.post("/api/analysis/product-sell").mock(side_effect=httpx.ConnectError("upstream unreachable"))

    with pytest.raises(MetamorphosisAPIFetchError) as exc_info:
        await load_all_data(70697, "2026-04-01", "2026-04-30", build_semantics=False)

    assert exc_info.value.api_name == "product_sell"
