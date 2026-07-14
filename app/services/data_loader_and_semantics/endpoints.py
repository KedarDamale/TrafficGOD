from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Literal


class Dataset(StrEnum):
    SALES_PERIOD = "sales_period"
    SERVICE_SELL = "service_sell"
    PRODUCT_SELL = "product_sell"


class ParamStyle(StrEnum):
    QUERY_SNAKE = "query_snake"
    BODY_CAMEL = "body_camel"


@dataclass(frozen=True, slots=True)
class EndpointSpec:
    dataset: Dataset
    path: str
    method: Literal["GET", "POST"]
    param_style: ParamStyle
    success_key: str
    records_are_list: bool


ENDPOINTS: dict[Dataset, EndpointSpec] = {
    Dataset.SALES_PERIOD: EndpointSpec(
        dataset=Dataset.SALES_PERIOD,
        path="/api/billing/sales-period",
        method="GET",
        param_style=ParamStyle.QUERY_SNAKE,
        success_key="success",
        records_are_list=True,
    ),
    Dataset.SERVICE_SELL: EndpointSpec(
        dataset=Dataset.SERVICE_SELL,
        path="/api/analysis/service-sell",
        method="POST",
        param_style=ParamStyle.BODY_CAMEL,
        success_key="status",
        records_are_list=False,
    ),
    Dataset.PRODUCT_SELL: EndpointSpec(
        dataset=Dataset.PRODUCT_SELL,
        path="/api/analysis/product-sell",
        method="POST",
        param_style=ParamStyle.BODY_CAMEL,
        success_key="status",
        records_are_list=False,
    ),
}
