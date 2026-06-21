# Author: Bishakh
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base every ORM model inherits from.

    Lives alone (no engine/session here) so models can import it without
    pulling in database-connection code — avoids import cycles.
    """

    pass
