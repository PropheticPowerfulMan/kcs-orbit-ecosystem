from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EduSync AI Communication Hub"
    app_env: str = "dev"
    app_debug: bool = True

    api_prefix: str = "/api/v1"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    database_url: str = "sqlite:///./edusync.db"

    cors_origins: list[str] = ["http://localhost:5173"]
    cors_origin_regex: str | None = r"http://(localhost|127\.0\.0\.1):517[0-9]"

    spacy_model: str = "en_core_web_sm"
    transformer_model: str = "distilbert-base-uncased"

    scheduler_enabled: bool = True
    orbit_outbox_retry_interval_seconds: int = 30

    kcs_orbit_api_url: str = ""
    kcs_orbit_api_key: str = ""
    kcs_orbit_organization_id: str = ""
    kcs_orbit_timeout_seconds: int = 5

    edupay_api_url: str = ""
    edupay_login_path: str = "/api/auth/login"
    edupay_timeout_seconds: int = 5

    savanex_api_url: str = ""
    savanex_login_path: str = "/api/integration/authenticate/"
    kcs_nexus_api_url: str = ""
    kcs_nexus_login_path: str = "/api/auth/login"
    kcs_nexus_timeout_seconds: int = 5
    savanex_timeout_seconds: int = 5

    external_ai_enabled: bool = False
    external_ai_provider: str = "openai_compatible"
    external_ai_base_url: str = ""
    external_ai_api_key: str = ""
    external_ai_model: str = ""
    external_ai_timeout_seconds: int = 12

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", extra="ignore")


settings = Settings()

if settings.app_env.lower() in {"prod", "production"} and settings.jwt_secret in {"change-me", "dev-secret", "dev_secret"}:
    raise RuntimeError("EduSync production configuration is unsafe. Set a strong JWT_SECRET.")
