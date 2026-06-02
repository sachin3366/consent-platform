from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./consent.db")

# connect_args is SQLite-specific — allows multiple threads to share one connection
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=True,  # logs every SQL query to the console — helpful while learning
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    # This is a "generator" — FastAPI calls it to open a DB session per request,
    # then automatically closes it when the request is done (the `finally` block)
    with Session(engine) as session:
        yield session
