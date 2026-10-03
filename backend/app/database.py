"""
Database connection and session management.
Provides:
- engine: SQLAlchemy engine connected to PostgreSQL (with SQLite fallback for local testing)
- SessionLocal: sessionmaker for database transactions
- Base: declarative base class for all database models
- get_db(): FastAPI dependency for injecting database sessions into route handlers
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL, RUNTIME_DIR

logger = logging.getLogger(__name__)

# Primary database engine setup
# If running with SQLite, connect_args check_same_thread is needed
connect_args = {}
db_url = DATABASE_URL

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    # Test connection quickly
    with engine.connect() as conn:
        pass
    print(f"[Database] Connected successfully to: {db_url.split('@')[-1] if '@' in db_url else db_url}")
except Exception as e:
    # If PostgreSQL is not reachable (e.g. running locally without docker postgres up),
    # gracefully fall back to local SQLite so development and tests never crash.
    print(f"[Database] Could not connect to primary DB ({e}). Falling back to SQLite for local development.")
    sqlite_path = RUNTIME_DIR / "face_attendance.db"
    db_url = f"sqlite:///{sqlite_path}"
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
    print(f"[Database] Fallback SQLite active at: {sqlite_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session per request
    and automatically closes it when the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
