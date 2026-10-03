# ── Backend: FastAPI + OpenCV ──
FROM python:3.11-slim

# OpenCV needs these system libs even in "headless" mode (libGL for image codecs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Models (~37MB) and known_faces data persist outside the image via a volume
# (see docker-compose.yml) so re-running the container doesn't re-download them.
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
