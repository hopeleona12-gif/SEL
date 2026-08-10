from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(__file__).resolve().parents[2] / "database" / "sel_assessment.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_compatibility() -> None:
    """Small SQLite migration bridge for this demo's pre-Alembic database."""
    additions = {
        "child": {
            "participant_group": "VARCHAR(64) NOT NULL DEFAULT 'unspecified'",
        },
        "assessment_session": {
            "age_at_assessment": "FLOAT NOT NULL DEFAULT 0",
            "participant_group": "VARCHAR(64) NOT NULL DEFAULT 'unspecified'",
            "practice_error_count": "INTEGER NOT NULL DEFAULT 0",
        },
        "response": {
            "condition": "VARCHAR(16) NOT NULL DEFAULT 'quiet'",
            "accuracy": "BOOLEAN NOT NULL DEFAULT 0",
            "stimulus_onset": "DATETIME",
            "sound_onset": "DATETIME",
            "practice_attempt_no": "INTEGER NOT NULL DEFAULT 1",
        },
        "score": {
            "quiet_score": "FLOAT",
            "distractor_score": "FLOAT",
            "go_omissions": "INTEGER",
            "no_go_false_alarms": "INTEGER",
            "mean_go_reaction_time_ms": "FLOAT",
            "go_reaction_time_sd_ms": "FLOAT",
        },
    }
    with engine.begin() as connection:
        for table_name, columns in additions.items():
            existing = {
                row[1] for row in connection.execute(
                    text(f"PRAGMA table_info({table_name})")
                )
            }
            for column_name, definition in columns.items():
                if existing and column_name not in existing:
                    connection.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
                    ))
        connection.execute(text("""
            UPDATE assessment_session
            SET age_at_assessment = COALESCE(
                (SELECT age FROM child WHERE child.child_id = assessment_session.child_id),
                age_at_assessment
            )
            WHERE age_at_assessment = 0
        """))
        connection.execute(text("""
            UPDATE assessment_session
            SET participant_group = COALESCE(
                (SELECT participant_group FROM child
                 WHERE child.child_id = assessment_session.child_id),
                participant_group
            )
            WHERE participant_group = 'unspecified'
        """))

        response_sql = connection.scalar(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='response'"
        )) or ""
        normalized_sql = "".join(response_sql.lower().split())
        old_unique = "unique(session_id,trial_id,phase)" in normalized_sql
        if old_unique:
            connection.execute(text("""
                CREATE TABLE response_migrated (
                    id INTEGER NOT NULL PRIMARY KEY,
                    session_id VARCHAR(64) NOT NULL REFERENCES assessment_session (session_id),
                    child_id VARCHAR(64) NOT NULL REFERENCES child (child_id),
                    task_id VARCHAR(16) NOT NULL,
                    trial_id VARCHAR(32) NOT NULL,
                    trial_order INTEGER NOT NULL,
                    phase VARCHAR(16) NOT NULL,
                    practice_attempt_no INTEGER NOT NULL DEFAULT 1,
                    condition VARCHAR(16) NOT NULL DEFAULT 'quiet',
                    stimulus VARCHAR(32) NOT NULL,
                    expected_response VARCHAR(16) NOT NULL,
                    actual_response VARCHAR(16) NOT NULL,
                    correct BOOLEAN NOT NULL,
                    accuracy BOOLEAN NOT NULL DEFAULT 0,
                    stimulus_onset DATETIME,
                    sound_onset DATETIME,
                    stimulus_started_time DATETIME NOT NULL,
                    response_time DATETIME,
                    reaction_time_ms INTEGER,
                    created_time DATETIME NOT NULL,
                    UNIQUE (session_id, trial_id, phase, practice_attempt_no)
                )
            """))
            connection.execute(text("""
                INSERT INTO response_migrated (
                    id, session_id, child_id, task_id, trial_id, trial_order, phase,
                    practice_attempt_no, condition, stimulus, expected_response,
                    actual_response, correct, accuracy, stimulus_onset, sound_onset,
                    stimulus_started_time, response_time, reaction_time_ms, created_time
                )
                SELECT
                    id, session_id, child_id, task_id, trial_id, trial_order, phase,
                    practice_attempt_no, condition, stimulus, expected_response,
                    actual_response, correct, accuracy, stimulus_onset, sound_onset,
                    stimulus_started_time, response_time, reaction_time_ms, created_time
                FROM response
            """))
            connection.execute(text("DROP TABLE response"))
            connection.execute(text("ALTER TABLE response_migrated RENAME TO response"))
            connection.execute(text(
                "CREATE INDEX ix_response_session_id ON response (session_id)"
            ))
            connection.execute(text(
                "CREATE INDEX ix_response_child_id ON response (child_id)"
            ))
