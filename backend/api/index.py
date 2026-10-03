import sys
from pathlib import Path

# Vercel ke handler ko app/ folder ka module resolve karne me help karta hai
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

# Vercel ka Python runtime ASGI apps (FastAPI) ko directly serve kar leta hai