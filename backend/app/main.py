from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import create_db_and_tables
from app import models  # noqa: F401 — registers models with SQLModel.metadata
from app.routers import consent


# lifespan runs setup code when the server starts and teardown when it stops
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()  # create DB tables on startup if they don't exist
    yield  # everything after yield runs on shutdown (nothing to do yet)


app = FastAPI(
    title="Consent Management Platform",
    description="API for managing consent banners and recording user consent choices",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS lets browsers on other domains (your frontend, embedded widget) call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict this in production
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(consent.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
