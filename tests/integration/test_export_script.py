from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pandas as pd
import pytest
import respx

from scripts.export_data_to_csv import DEFAULT_OUTPUT_DIR, parse_args, run_export

pytestmark = pytest.mark.anyio


def test_parse_args_defaults() -> None:
    args = parse_args([])

    assert args.user_map_id == 70697
    assert args.start_date == "2026-04-01"
    assert args.end_date == "2026-04-30"
    assert args.output_dir == DEFAULT_OUTPUT_DIR


def test_parse_args_overrides() -> None:
    args = parse_args(
        ["--user-map-id", "70688", "--start-date", "2026-01-01", "--end-date", "2026-01-31", "--output-dir", "custom_exports"]
    )

    assert args.user_map_id == 70688
    assert args.start_date == "2026-01-01"
    assert args.end_date == "2026-01-31"
    assert str(args.output_dir) == "custom_exports"


async def test_export_script_writes_five_csvs(
    mock_api: respx.MockRouter,
    sales_period_payload: dict,
    service_sell_payload: Callable[..., dict],
    product_sell_payload: Callable[..., dict],
    tmp_path: Path,
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

    output_dir = tmp_path / "exports"
    written_paths = await run_export(70697, "2026-04-01", "2026-04-30", output_dir=output_dir)

    assert len(written_paths) == 5
    assert all(path.exists() for path in written_paths)

    expected_names = {
        "sales_period_clinic_2026-04-01_2026-04-30.csv",
        "service_sell_clinic_2026-04-01_2026-04-30.csv",
        "service_sell_all_clinics_2026-04-01_2026-04-30.csv",
        "product_sell_clinic_2026-04-01_2026-04-30.csv",
        "product_sell_all_clinics_2026-04-01_2026-04-30.csv",
    }
    assert {path.name for path in written_paths} == expected_names

    sales_period_csv = next(p for p in written_paths if p.name.startswith("sales_period"))
    df = pd.read_csv(sales_period_csv)
    assert "sale_amount" in df.columns
    assert len(df) == 2
