from __future__ import annotations

import copy
from collections.abc import Callable, Iterator

import pytest
import respx

from app.core.cache.memory_cache import reset_cache
from app.core.config.settings import clear_settings_cache

_SALES_PERIOD_PAYLOAD: dict = {
    "success": True,
    "source": "docexa_billing_only",
    "meta": {
        "user_map_id": 70697,
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "location": {"user_map_id": 70697, "clinic_name": "Metamorphosis Aesthetic Pvt. Ltd.", "city": "Greater kailash"},
        "count": 2,
        "sum_net_amount": 28000,
    },
    "data": [
        {
            "billing_transaction_id": 56652,
            "billing_id": 59059,
            "invoice_no": "MC/GK/2627862",
            "receipt_no": "MC/GK/2627862-RECB2189025",
            "payment_date": "2026-04-30 16:23:10",
            "package_name": "Balance of full body LHR",
            "sale": {
                "amount": 20000,
                "tax_amount": 1000,
                "tax_percent": "5.00",
                "discount_amount": "0.00",
                "net_amount": 21000,
                "taxable_value": 20000,
                "total_invoice_value": 21000,
            },
            "payment": {"mode_of_payment": "UPI", "modes_from_logs": "UPI"},
            "patient": {"patient_id": 31631, "patient_name": "kriti wadhwa", "mobile_no": "8130506307"},
            "staff": {"id": 53, "staff_name": "Hina Kausar", "mobile": "8383844224"},
            "remarks": "Multiple payment transaction",
            "status": "success",
            "transaction_type": "payment",
            "source": "staging",
            "cancellation": {"is_cancel": False, "cancel_date": None, "cancel_remark": None},
        },
        {
            "billing_transaction_id": 56624,
            "billing_id": 60177,
            "invoice_no": "MC/GK/2627861",
            "receipt_no": "MC/GK/2627861-RECA66C0ABC",
            "payment_date": "2026-04-29 18:41:14",
            "package_name": "chin",
            "sale": {
                "amount": 6666,
                "tax_amount": 333.33,
                "tax_percent": "5.00",
                "discount_amount": "0.00",
                "net_amount": 7000,
                "taxable_value": 6666.67,
                "total_invoice_value": 7000,
            },
            "payment": {"mode_of_payment": "UPI", "modes_from_logs": "UPI"},
            "patient": {"patient_id": 32209, "patient_name": "jyoti .", "mobile_no": "9315789446"},
            "staff": {"id": 53, "staff_name": "Hina Kausar", "mobile": "8383844224"},
            "remarks": "Multiple payment transaction",
            "status": "success",
            "transaction_type": "payment",
            "source": "staging",
            "cancellation": {"is_cancel": False, "cancel_date": None, "cancel_remark": None},
        },
    ],
}

_SERVICE_SELL_CLINIC_PAYLOAD: dict = {
    "status": True,
    "message": "Service sell data retrieved successfully",
    "code": 200,
    "data": {
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "scope": "clinic",
        "user_map_id": 70697,
        "revenue": 125000.00,
        "collection": 98000.00,
        "outstanding": 27000.00,
    },
}

_SERVICE_SELL_ALL_CLINICS_PAYLOAD: dict = {
    "status": True,
    "message": "Service sell data retrieved successfully (all clinics)",
    "code": 200,
    "data": {
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "scope": "all_clinics",
        "user_map_id": None,
        "revenue": 850000.00,
        "collection": 720000.00,
        "outstanding": 130000.00,
    },
}

_PRODUCT_SELL_CLINIC_PAYLOAD: dict = {
    "status": True,
    "message": "Product sell data retrieved successfully",
    "code": 200,
    "data": {
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "scope": "clinic",
        "user_map_id": 70697,
        "revenue": 45000.00,
        "collection": 42000.00,
        "outstanding": 3000.00,
    },
}

_PRODUCT_SELL_ALL_CLINICS_PAYLOAD: dict = {
    "status": True,
    "message": "Product sell data retrieved successfully (all clinics)",
    "code": 200,
    "data": {
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "scope": "all_clinics",
        "user_map_id": None,
        "revenue": 210000.00,
        "collection": 195000.00,
        "outstanding": 15000.00,
    },
}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def _reset_state() -> Iterator[None]:
    clear_settings_cache()
    reset_cache()
    yield
    clear_settings_cache()
    reset_cache()


@pytest.fixture
def mock_api() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url="https://metamorphosis.youv.ai", assert_all_called=False) as router:
        yield router


@pytest.fixture
def sales_period_payload() -> dict:
    return copy.deepcopy(_SALES_PERIOD_PAYLOAD)


@pytest.fixture
def service_sell_payload() -> Callable[..., dict]:
    def _make(*, all_clinics: bool = False) -> dict:
        return copy.deepcopy(_SERVICE_SELL_ALL_CLINICS_PAYLOAD if all_clinics else _SERVICE_SELL_CLINIC_PAYLOAD)

    return _make


@pytest.fixture
def product_sell_payload() -> Callable[..., dict]:
    def _make(*, all_clinics: bool = False) -> dict:
        return copy.deepcopy(_PRODUCT_SELL_ALL_CLINICS_PAYLOAD if all_clinics else _PRODUCT_SELL_CLINIC_PAYLOAD)

    return _make
