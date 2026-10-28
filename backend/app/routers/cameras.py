"""
Cameras Router:
Endpoints for managing CCTV cameras (CRUD), testing RTSP stream reachability,
and streaming live MJPEG video with face recognition overlays.
"""

from typing import List, Optional
import os
import re
import cv2
import time
import shutil
from pathlib import Path
import numpy as np

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Camera
from ..schemas import CameraOut, CameraCreate, CameraUpdate
from ..camera_service import camera_service
from ..config import TEST_VIDEOS_DIR, ALLOWED_VIDEO_EXTENSIONS, KNOWN_FACES_DIR

router = APIRouter(prefix="/api/cameras", tags=["CCTV Cameras"])


def extract_video_metadata(file_path: Path) -> dict:
    """Extract resolution, fps, frame count and duration from a video file."""
    width, height, fps, frame_count, duration_sec = 0, 0, 15.0, 0, 0.0
    try:
        cap = cv2.VideoCapture(str(file_path))
        if cap.isOpened():
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            c_fps = cap.get(cv2.CAP_PROP_FPS)
            fps = round(c_fps, 2) if c_fps and c_fps > 0 else 15.0
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration_sec = round(frame_count / fps, 1) if fps > 0 else 0.0
            cap.release()
    except Exception:
        pass

    size_bytes = file_path.stat().st_size
    size_mb = round(size_bytes / (1024 * 1024), 2)
    filename = file_path.name

    return {
        "filename": filename,
        "relative_path": f"test_videos/{filename}",
        "size_bytes": size_bytes,
        "size_formatted": f"{size_mb} MB" if size_mb >= 1.0 else f"{round(size_bytes / 1024, 1)} KB",
        "width": width,
        "height": height,
        "fps": fps,
        "frame_count": frame_count,
        "duration_sec": duration_sec,
        "preview_url": f"/api/test-videos/{filename}",
        "modified_at": file_path.stat().st_mtime,
    }


class TestConnectionRequest(BaseModel):
    source: str


@router.get("", response_model=List[CameraOut])
def list_cameras(db: Session = Depends(get_db)):
    """List all registered CCTV cameras with real-time stream status."""
    cameras = db.query(Camera).filter(Camera.is_active == True).order_by(Camera.id.asc()).all()
    result = []
    for c in cameras:
        # Check active stream status
        stream = camera_service.streams.get(c.id)
        current_status = "online" if (stream and stream.is_online) else c.status

        result.append(CameraOut(
            id=c.id,
            name=c.name,
            location=c.location,
            rtsp_url=c.rtsp_url,
            fps=c.fps,
            status=current_status,
            is_active=c.is_active,
            created_at=c.created_at,
        ))
    return result


@router.get("/test-videos")
def list_test_videos():
    """List all available uploaded/generated test video files with metadata."""
    videos = []
    if TEST_VIDEOS_DIR.exists():
        for p in TEST_VIDEOS_DIR.iterdir():
            if p.is_file() and p.suffix.lower() in ALLOWED_VIDEO_EXTENSIONS:
                videos.append(extract_video_metadata(p))
    # Sort by newest modified first
    videos.sort(key=lambda x: x["modified_at"], reverse=True)
    return videos


@router.post("/upload-video")
async def upload_test_video(file: UploadFile = File(...)):
    """Upload a video file for multi-camera testing."""
    filename = file.filename or "video.mp4"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}"
        )

    # Sanitize filename
    clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", Path(filename).stem)
    clean_name = f"{clean_stem}{ext}"
    target_path = TEST_VIDEOS_DIR / clean_name

    # If already exists, append timestamp to make it unique
    if target_path.exists():
        clean_name = f"{clean_stem}_{int(time.time())}{ext}"
        target_path = TEST_VIDEOS_DIR / clean_name

    try:
        with open(target_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                f.write(chunk)
    except Exception as e:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

    # Verify video validity with OpenCV
    cap = cv2.VideoCapture(str(target_path))
    if not cap.isOpened():
        cap.release()
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid or readable video.")

    ret, frame = cap.read()
    cap.release()
    if not ret or frame is None:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=400, detail="Cannot decode video frames from uploaded file.")

    return extract_video_metadata(target_path)


@router.delete("/test-videos/{filename}")
def delete_test_video(filename: str):
    """Delete an uploaded test video file."""
    safe_name = Path(filename).name
    target_path = TEST_VIDEOS_DIR / safe_name
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"Video file '{safe_name}' not found.")

    try:
        target_path.unlink()
        return {"status": "success", "message": f"Deleted {safe_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


class GenerateSampleVideoRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = "Campus Main Gate"


@router.post("/generate-sample-video")
def generate_sample_video(payload: Optional[GenerateSampleVideoRequest] = None):
    """
    Generate a synthetic CCTV surveillance test video with smooth movement,
    realistic timestamp, and registered face if available, for instant multi-camera testing.
    """
    target_name = payload.name if (payload and payload.name) else f"sample_cctv_{int(time.time()) % 10000}.mp4"
    if not target_name.endswith(".mp4"):
        target_name += ".mp4"

    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", target_name)
    target_path = TEST_VIDEOS_DIR / safe_name

    loc_label = (payload.location if (payload and payload.location) else "Main Gate Entrance").upper()

    # Find registered face if available
    face_photos = list(KNOWN_FACES_DIR.glob("*.jpg")) + list(KNOWN_FACES_DIR.glob("*.png"))
    face_img = None
    if face_photos:
        face_img = cv2.imread(str(face_photos[0]))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(target_path), fourcc, 15.0, (640, 480))

    if not out.isOpened():
        raise HTTPException(status_code=500, detail="Could not initialize OpenCV VideoWriter.")

    if face_img is not None:
        fh, fw = face_img.shape[:2]
        target_w = 120
        target_h = int(120 * fh / fw)
        face_resized = cv2.resize(face_img, (target_w, target_h))
    else:
        target_w, target_h = 100, 120
        face_resized = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        face_resized[:] = (180, 160, 150)
        cv2.circle(face_resized, (50, 45), 25, (220, 200, 190), -1)

    total_frames = 60  # 4 seconds at 15 FPS
    for i in range(total_frames):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:] = (35, 40, 45)  # Dark CCTV theme
        cv2.line(frame, (0, 390), (640, 390), (65, 70, 75), 2)
        cv2.line(frame, (120, 0), (20, 480), (50, 55, 60), 1)
        cv2.line(frame, (520, 0), (620, 480), (50, 55, 60), 1)

        # Smooth walking motion
        x = int(80 + (340 * (i / float(total_frames))))
        y = int(140 + np.sin(i * 0.25) * 6)

        # Place face
        frame[y:y + target_h, x:x + target_w] = face_resized

        # Security camera OSD overlay
        cv2.putText(
            frame,
            f"REC [CAM: {loc_label}] {time.strftime('%Y-%m-%d %H:%M')}:{i // 15:02d}",
            (16, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (45, 212, 191),
            1,
            cv2.LINE_AA,
        )
        out.write(frame)

    out.release()
    return extract_video_metadata(target_path)


@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    """Register a new CCTV camera (RTSP stream, webcam, or video file)."""
    raw_source = payload.rtsp_url.strip()
    if (TEST_VIDEOS_DIR / raw_source).is_file():
        raw_source = f"test_videos/{raw_source}"

    cam = Camera(
        name=payload.name.strip(),
        location=payload.location.strip(),
        rtsp_url=raw_source,
        fps=payload.fps,
        status="offline",
        is_active=True,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    """Get camera information by ID."""
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    stream = camera_service.streams.get(cam.id)
    if stream:
        cam.status = "online" if stream.is_online else "offline"

    return cam


@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(camera_id: int, payload: CameraUpdate, db: Session = Depends(get_db)):
    """Update camera configuration."""
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    if payload.name is not None:
        cam.name = payload.name.strip()
    if payload.location is not None:
        cam.location = payload.location.strip()
    if payload.rtsp_url is not None:
        raw_source = payload.rtsp_url.strip()
        if (TEST_VIDEOS_DIR / raw_source).is_file():
            raw_source = f"test_videos/{raw_source}"
        cam.rtsp_url = raw_source
    if payload.fps is not None:
        cam.fps = payload.fps
    if payload.is_active is not None:
        cam.is_active = payload.is_active

    db.commit()
    db.refresh(cam)

    # If stream is running, restart with updated config
    if cam.id in camera_service.streams:
        camera_service.stop_stream(cam.id)
        if cam.is_active:
            camera_service.get_or_create_stream(cam)

    return cam


@router.delete("/{camera_id}", status_code=status.HTTP_200_OK)
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    """Delete a camera and terminate its background capture thread."""
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera_service.stop_stream(camera_id)
    db.delete(cam)
    db.commit()
    return {"status": "success", "message": f"Camera {camera_id} deleted"}


@router.post("/test-source")
def test_stream_source(payload: TestConnectionRequest):
    """Test if an RTSP URL or device index is reachable."""
    success, message = camera_service.test_connection(payload.source)
    return {"success": success, "message": message}


@router.get("/{camera_id}/stream")
def stream_camera(camera_id: int, db: Session = Depends(get_db)):
    """
    Live video stream endpoint: yields multipart MJPEG stream with face detection overlays.
    Can be used directly in HTML <img> tags: `<img src="/api/cameras/1/stream" />`.
    """
    cam = db.query(Camera).filter(Camera.id == camera_id, Camera.is_active == True).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found or inactive")

    return StreamingResponse(
        camera_service.generate_mjpeg(cam),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
