"""
Cameras Router:
Endpoints for managing CCTV cameras (CRUD), testing RTSP stream reachability,
and streaming live MJPEG video with face recognition overlays.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Camera
from ..schemas import CameraOut, CameraCreate, CameraUpdate
from ..camera_service import camera_service

router = APIRouter(prefix="/api/cameras", tags=["CCTV Cameras"])


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


@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    """Register a new CCTV camera."""
    cam = Camera(
        name=payload.name.strip(),
        location=payload.location.strip(),
        rtsp_url=payload.rtsp_url.strip(),
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
        cam.rtsp_url = payload.rtsp_url.strip()
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
