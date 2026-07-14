from __future__ import annotations

from enum import StrEnum
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    LOCAL = "local"
    DEV = "dev"
    QA = "qa"
    PRE_PROD = "pre_production"
    PROD = "production"


class Settings(BaseSettings):
    env: Env = Field(default=Env.LOCAL)

    metamorphosis_base_url: str = "https://metamorphosis.youv.ai"
    http_timeout_seconds: float = 30.0
    http_connect_timeout_seconds: float = 10.0
    cache_ttl_seconds: int = 3600
    cache_maxsize: int = 64
    llm_key: str | None = None

    @property
    def is_local(self) -> bool:
        return self.env == Env.LOCAL

    @property
    def is_dev(self) -> bool:
        return self.env == Env.DEV

    @property
    def is_qa(self) -> bool:
        return self.env == Env.QA

    @property
    def is_pre_prod(self) -> bool:
        return self.env == Env.PRE_PROD

    @property
    def is_prod(self) -> bool:
        return self.env == Env.PROD

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
