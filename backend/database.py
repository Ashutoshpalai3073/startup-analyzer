import os
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, ForeignKey, func, inspect as sa_inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./startup_analyzer.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    email       = Column(String, unique=True, index=True, nullable=False)
    name        = Column(String, nullable=False)          # not unique — Google users may share names
    google_id   = Column(String, unique=True, nullable=True, index=True)
    auth_method = Column(String, nullable=False, default="otp")   # "otp" | "google"
    avatar_url  = Column(String, nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    last_login  = Column(DateTime, nullable=True)


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String, index=True)
    otp_code   = Column(String)
    name       = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_verified = Column(Boolean, default=False)
    expires_at = Column(DateTime)


class SavedAnalysis(Base):
    __tablename__ = "saved_analyses"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), index=True)
    startup_idea    = Column(String)
    analysis_json   = Column(Text)
    viability_score = Column(Integer, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


def _migrate():
    """
    Idempotent migration: adds auth_method / avatar_url columns and removes the
    unique constraint on name (needed so Google users with common names can sign up).
    Runs on every startup but only does work on the first run.
    """
    insp = sa_inspect(engine)
    if not insp.has_table("users"):
        return  # fresh DB — create_all will build the correct schema

    existing_cols = {c["name"] for c in insp.get_columns("users")}
    if "auth_method" in existing_cols:
        return  # already migrated

    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=off"))
        conn.execute(text("""
            CREATE TABLE users_new (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       VARCHAR UNIQUE NOT NULL,
                name        VARCHAR NOT NULL,
                google_id   VARCHAR UNIQUE,
                auth_method VARCHAR NOT NULL DEFAULT 'otp',
                avatar_url  VARCHAR,
                is_active   BOOLEAN DEFAULT 1,
                created_at  DATETIME,
                last_login  DATETIME
            )
        """))
        conn.execute(text("""
            INSERT INTO users_new
                (id, email, name, google_id, auth_method, avatar_url, is_active, created_at, last_login)
            SELECT id, email, name, google_id, 'otp', NULL, is_active, created_at, last_login
            FROM users
        """))
        conn.execute(text("DROP TABLE users"))
        conn.execute(text("ALTER TABLE users_new RENAME TO users"))
        conn.execute(text("PRAGMA foreign_keys=on"))
        conn.commit()


_migrate()
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
