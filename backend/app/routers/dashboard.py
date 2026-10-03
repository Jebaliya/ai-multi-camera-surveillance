"""
Dashboard Router:
Aggregates key metrics, counts, and recent events for the ERP surveillance dashboard.
"""

from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import User, Camera, Attendance, Alert, ActivityLog
from ..camera_service import camera_service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Retrieve consolidated KPIs for the main dashboard view."""
    today = date.today()

    # 1. User counts
    total_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    students_count = db.query(func.count(User.id)).filter(User.is_active == True, User.role.ilike("Student")).scalar() or 0
    teachers_count = db.query(func.count(User.id)).filter(User.is_active == True, User.role.ilike("Teacher")).scalar() or 0
    employees_count = db.query(func.count(User.id)).filter(User.is_active == True, User.role.ilike("Employee")).scalar() or 0

    # 2. Camera counts
    cameras = db.query(Camera).filter(Camera.is_active == True).all()
    total_cameras = len(cameras)
    active_cameras = 0
    for cam in cameras:
        stream = camera_service.streams.get(cam.id)
        if stream and stream.is_online:
            active_cameras += 1

    # 3. Today's attendance
    today_attendance_count = (
        db.query(func.count(Attendance.id))
        .filter(Attendance.attendance_date == today)
        .scalar() or 0
    )

    attendance_percentage = (
        round((today_attendance_count / total_users) * 100, 1)
        if total_users > 0 else 0
    )

    # 4. Alerts count
    pending_alerts_count = (
        db.query(func.count(Alert.id))
        .filter(Alert.status == "Pending")
        .scalar() or 0
    )

    # 5. Recent 5 attendance events
    recent_attendance = (
        db.query(Attendance)
        .join(User, Attendance.user_id == User.id)
        .filter(Attendance.attendance_date == today)
        .order_by(Attendance.entry_time.desc())
        .limit(5)
        .all()
    )

    recent_att_list = []
    for a in recent_attendance:
        recent_att_list.append({
            "name": a.user.name,
            "role": a.user.role,
            "time": a.entry_time.strftime("%I:%M %p") if a.entry_time else "",
            "confidence": int(a.confidence_score * 100),
        })

    return {
        "total_users": total_users,
        "students_count": students_count,
        "teachers_count": teachers_count,
        "employees_count": employees_count,
        "active_cameras": active_cameras,
        "total_cameras": total_cameras,
        "today_attendance_count": today_attendance_count,
        "attendance_percentage": attendance_percentage,
        "pending_alerts_count": pending_alerts_count,
        "recent_attendance": recent_att_list,
    }
