"""
Face Recognition Attendance System — FastAPI Backend (API-only)

Uses OpenCV's built-in YuNet (face detection) + SFace (face recognition).
Models auto-download on first run (~37 MB total). No dlib, no TensorFlow.

This app now serves JSON only — the frontend is a separate React (Vite)
app that talks to it over HTTP (see ../../frontend). CORS is enabled for
the Vite dev server origin (see app/config.py -> ALLOWED_ORIGINS).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import ALLOWED_ORIGINS, KNOWN_FACES_DIR
from .database import engine, Base
from .face_service import face_service
from .camera_service import camera_service
from .routers import recognition, registration, attendance, users, cameras, activity, dashboard, alerts


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n-- Startup: Initializing Database & AI Models -----")
    # Auto-create all tables in PostgreSQL if they don't exist
    try:
        Base.metadata.create_all(bind=engine)
        print("[Database] Schema verified and tables created.")
    except Exception as e:
        print(f"[Database] Warning: Table creation error: {e}")

    # Initialize YuNet detector + SFace recognizer & sync face embeddings
    face_service.startup()
    print("-- System Ready -- http://localhost:8000\n")
    yield

    # Shutdown: gracefully terminate camera threads
    print("\n-- Shutdown: Terminating Camera Streams -----------")
    camera_service.stop_all()


app = FastAPI(title="Face Attendance & ERP API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for registered user photos
app.mount("/api/faces", StaticFiles(directory=str(KNOWN_FACES_DIR)), name="faces")

# Routers
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(cameras.router)
app.include_router(activity.router)
app.include_router(alerts.router)
app.include_router(recognition.router)
app.include_router(registration.router)
app.include_router(attendance.router)






@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "registered": len(face_service.known_people),
        "db_synced": True,
    }

