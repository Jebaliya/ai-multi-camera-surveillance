"""
Activity Tracking Router:
Endpoints for multi-camera person movement history, event logging,
and chronological person activity timelines.
"""

from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from ..database import get_db
from ..models import ActivityLog, User, Camera
from ..schemas import ActivityLogOut, TimelineEvent

router = APIRouter(prefix="/api/activity", tags=["Person Activity Tracking"])


@router.get("/logs", response_model=List[ActivityLogOut])
def get_activity_logs(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    camera_id: Optional[int] = Query(None, description="Filter by camera ID"),
    log_date: Optional[date] = Query(None, description="Filter by specific date"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieve paginated activity logs across cameras."""
    query = db.query(ActivityLog).join(User, ActivityLog.user_id == User.id)

    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if camera_id:
        query = query.filter(ActivityLog.camera_id == camera_id)
    if log_date:
        query = query.filter(func.date(ActivityLog.timestamp) == log_date)

    logs = query.order_by(desc(ActivityLog.timestamp)).offset(offset).limit(limit).all()

    result = []
    for log in logs:
        cam = db.query(Camera).filter(Camera.id == log.camera_id).first() if log.camera_id else None
        result.append(ActivityLogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else "Unknown",
            camera_id=log.camera_id,
            camera_name=cam.name if cam else "Webcam",
            location=log.location,
            timestamp=log.timestamp,
            confidence_score=log.confidence_score,
            snapshot_path=log.snapshot_path,
        ))
    return result


@router.get("/timeline/{user_id}", response_model=List[TimelineEvent])
def get_person_timeline(
    user_id: int,
    timeline_date: Optional[date] = Query(None, description="Filter timeline by date (default: today)"),
    db: Session = Depends(get_db),
):
    """
    Get chronological movement timeline for a specific person on a given date.
    Example: 08:00 AM Bus CCTV -> 09:10 AM Classroom CCTV -> 11:30 AM Lab CCTV.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_date = timeline_date or date.today()

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == user_id,
            func.date(ActivityLog.timestamp) == target_date,
        )
        .order_by(ActivityLog.timestamp.asc())
        .all()
    )

    timeline = []
    # Deduplicate rapid consecutive detections at the same location within 2 minutes
    last_loc = None
    last_time = None

    for log in logs:
        if (
            last_loc == log.location
            and last_time is not None
            and (log.timestamp - last_time).total_seconds() < 120
        ):
            continue

        last_loc = log.location
        last_time = log.timestamp

        cam = db.query(Camera).filter(Camera.id == log.camera_id).first() if log.camera_id else None
        timeline.append(TimelineEvent(
            id=log.id,
            time=log.timestamp.strftime("%I:%M %p"),
            date=log.timestamp.strftime("%Y-%m-%d"),
            location=log.location,
            camera_name=cam.name if cam else "Main Camera",
            confidence_score=log.confidence_score,
            snapshot_path=log.snapshot_path,
        ))

    return timeline


@router.get("/recent", response_model=List[ActivityLogOut])
def get_recent_sightings(db: Session = Depends(get_db)):
    """Get the 10 most recent sightings across all cameras for dashboard feeds."""
    logs = (
        db.query(ActivityLog)
        .join(User, ActivityLog.user_id == User.id)
        .order_by(desc(ActivityLog.timestamp))
        .limit(10)
        .all()
    )

    result = []
    for log in logs:
        cam = db.query(Camera).filter(Camera.id == log.camera_id).first() if log.camera_id else None
        result.append(ActivityLogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else "Unknown",
            camera_id=log.camera_id,
            camera_name=cam.name if cam else "Webcam",
            location=log.location,
            timestamp=log.timestamp,
            confidence_score=log.confidence_score,
            snapshot_path=log.snapshot_path,
        ))
    return result
