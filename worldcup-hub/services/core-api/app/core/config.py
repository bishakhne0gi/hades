# Author: Bishakh
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Application configuration, read once from the environment.

    Centralising config here means no other module reads os.getenv directly —
    they import `settings`. One place to change, easy to override in tests.
    """

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
    # Reads go to a replica when set; otherwise fall back to the primary URL.
    read_database_url: str = os.getenv(
        "READ_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///./dev.db")
    )


settings = Settings()
