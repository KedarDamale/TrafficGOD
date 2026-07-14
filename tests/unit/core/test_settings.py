from __future__ import annotations

import pytest

from app.core.config.settings import Env, Settings, clear_settings_cache, get_settings


def test_env_has_local_member() -> None:
    assert Env.LOCAL == "local"


def test_default_env_is_local() -> None:
    settings = Settings(_env_file=None)
    assert settings.env == Env.LOCAL


def test_is_local_property() -> None:
    settings = Settings(_env_file=None)
    assert settings.is_local is True
    assert settings.is_dev is False


def test_is_qa_and_is_pre_prod_properties() -> None:
    qa_settings = Settings(_env_file=None, env=Env.QA)
    assert qa_settings.is_qa is True
    assert qa_settings.is_pre_prod is False

    pre_prod_settings = Settings(_env_file=None, env=Env.PRE_PROD)
    assert pre_prod_settings.is_pre_prod is True
    assert pre_prod_settings.is_qa is False


def test_new_settings_field_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.metamorphosis_base_url == "https://metamorphosis.youv.ai"
    assert settings.http_timeout_seconds == 30.0
    assert settings.http_connect_timeout_seconds == 10.0
    assert settings.cache_ttl_seconds == 3600
    assert settings.cache_maxsize == 64
    assert settings.llm_key is None


def test_env_override_via_environment_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "production")
    clear_settings_cache()

    settings = get_settings()

    assert settings.env == Env.PROD
    assert settings.is_prod is True


def test_clear_settings_cache_returns_fresh_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    first = get_settings()

    monkeypatch.setenv("CACHE_MAXSIZE", "128")
    clear_settings_cache()

    second = get_settings()

    assert first is not second
    assert second.cache_maxsize == 128
