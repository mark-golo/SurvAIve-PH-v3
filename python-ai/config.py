from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    florence2_secret: str = "dev_secret_change_in_production"
    model_name: str = "microsoft/Florence-2-base"
    model_revision: str = "main"
    device: str = "cpu"
    max_image_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_image_px: int = 1024  # resize longest edge to this
    allowed_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
