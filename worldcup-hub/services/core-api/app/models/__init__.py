# Author: Bishakh
# Import every model here so that `Base.metadata` knows about all tables
# whenever this package is imported (used by create_all on startup).
from app.models.team import Team
from app.models.fixture import Fixture

__all__ = ["Team", "Fixture"]
