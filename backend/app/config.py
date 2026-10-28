"""
Central configuration: paths, model URLs, and tunables.
"""

from pathlib import Path
import os

# ── Paths ────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# On Vercel (serverless), only /tmp is writable — the rest of the
# deployment bundle is read-only. Locally / in Docker, use normal
# folders next to the app so data persists across restarts.
if os.environ.get("VERCEL"):
    RUNTIME_DIR = Path("/tmp")
else:
    RUNTIME_DIR = BASE_DIR

KNOWN_FACES_DIR = RUNTIME_DIR / "known_faces"
MODELS_DIR = RUNTIME_DIR / "models"
TEST_VIDEOS_DIR = RUNTIME_DIR / "test_videos"

KNOWN_FACES_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
TEST_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# Video file extensions accepted for multi-camera simulation
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}

# ── Database Configuration ──────────────────────────────────
# In Docker, DATABASE_URL is passed via environment variable (e.g., postgresql://postgres:postgres@postgres:5432/face_attendance)
# For local host development, default points to mapped port 5434 or SQLite fallback
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5434/face_attendance"
)

# ── Model files (OpenCV Zoo — auto-downloaded) ──────────────
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
)
YUNET_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"

# SFace cosine similarity threshold (OpenCV-recommended default)
COSINE_THRESHOLD = 0.363

# UI-facing score mapping range (raw threshold..1.0  ->  0.80..0.99)
SCORE_UI_MIN = 0.80
SCORE_UI_MAX = 0.99

# CORS: origins allowed to call this API (Vite dev server, Docker frontend, etc.)
_extra_origins = os.environ.get("CORS_EXTRA_ORIGINS", "")
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8005",
] + [o.strip() for o in _extra_origins.split(",") if o.strip()]