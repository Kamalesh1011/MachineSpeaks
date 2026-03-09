from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Machine Guardian AI Backend"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change_this_to_a_long_random_secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/machine_guardian"

    CLAUDE_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@machine-guardian.local"

    WEBHOOK_URL: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:8080"
    ENABLE_DEMO_SEED: bool = True
    ENFORCE_HTTPS_INGEST: bool = False

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
