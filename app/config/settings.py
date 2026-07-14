from __future__ import annotations

from enum import StrEnum
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    DEV = "dev"
    QA = "qa"
    PRE_PROD = "pre_production"
    PROD = "production"


class Settings(BaseSettings):
    env: Env = Field(default=Env.LOCAL)

    @property
    def is_local(self) -> bool:
        return self.env == Env.LOCAL

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
