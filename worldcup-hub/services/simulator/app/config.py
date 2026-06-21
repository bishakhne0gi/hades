# Author: Bishakh
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Fixtures the live publisher continuously "plays". Seeds keep them deterministic.
DEMO_FIXTURES = [
    {"id": 1, "seed": 42},
    {"id": 2, "seed": 7},
    {"id": 3, "seed": 13},
    {"id": 4, "seed": 99},
]

# Seconds between published events (accelerates a 90' match into a lively feed).
EVENT_INTERVAL = float(os.getenv("EVENT_INTERVAL", "0.5"))
# Pause before a finished match restarts (loops the feed forever).
LOOP_PAUSE = float(os.getenv("LOOP_PAUSE", "4"))
