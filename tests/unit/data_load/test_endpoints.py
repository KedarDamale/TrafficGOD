from __future__ import annotations

from app.services.data_loader_and_semantics.endpoints import ENDPOINTS, Dataset, ParamStyle


def test_registry_covers_all_datasets() -> None:
    assert set(ENDPOINTS) == set(Dataset)


def test_sales_period_spec_is_get_query_snake() -> None:
    spec = ENDPOINTS[Dataset.SALES_PERIOD]
    assert spec.method == "GET"
    assert spec.param_style is ParamStyle.QUERY_SNAKE
    assert spec.path == "/api/billing/sales-period"
    assert spec.success_key == "success"
    assert spec.records_are_list is True


def test_service_and_product_sell_specs_are_post_body_camel() -> None:
    for dataset, path in (
        (Dataset.SERVICE_SELL, "/api/analysis/service-sell"),
        (Dataset.PRODUCT_SELL, "/api/analysis/product-sell"),
    ):
        spec = ENDPOINTS[dataset]
        assert spec.method == "POST"
        assert spec.param_style is ParamStyle.BODY_CAMEL
        assert spec.path == path
        assert spec.success_key == "status"
        assert spec.records_are_list is False
