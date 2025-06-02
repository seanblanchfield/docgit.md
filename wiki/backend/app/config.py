from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GIT_REPO_PATH: str = "/data/repo"
    GIT_AUTHOR_NAME: str = "Wiki System"
    GIT_AUTHOR_EMAIL: str = "wiki-system@example.com"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Create a single instance to be imported and used elsewhere
settings = Settings()
