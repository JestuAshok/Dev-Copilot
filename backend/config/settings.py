import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # API Configurations
    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash")
    
    # Path Configurations
    base_dir: Path = Path(__file__).resolve().parent.parent
    workspace_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "workspace")
    uploads_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "uploads")
    db_path: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "database" / "copilot.db")
    chroma_db_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "memory" / "chroma_db")
    logs_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "logs")
    
    # Model Hyperparameters
    temperature: float = 0.7
    max_tokens: int = 4096
    
    # Server Settings
    host: str = "127.0.0.1"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
settings.workspace_dir.mkdir(parents=True, exist_ok=True)
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
settings.db_path.parent.mkdir(parents=True, exist_ok=True)
settings.chroma_db_dir.mkdir(parents=True, exist_ok=True)
settings.logs_dir.mkdir(parents=True, exist_ok=True)
