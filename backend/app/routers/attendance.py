"""
Attendance Router:
Provides endpoints for daily and monthly attendance reporting,
entry/exit tracking, search & role filters, and CSV export.
"""

import io
import csv
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from ..database import get_db
from ..models import Attendance, User, Camera
from ..schemas import AttendanceOut, MonthlyAttendanceItem
from ..face_service import face_service

router = APIRouter(prefix="/api/attendance", tags=["Attendance Management"])


@router.get("/today", response_model=List[AttendanceOut])
def get_today_attendance(db: Session = Depends(get_db)):
    """Retrieve all attendance records for today with entry and exit times."""
    today_date = date.today()
    records = (
        db.query(Attendance)
        .join(User, Attendance.user_id == User.id)
        .filter(Attendance.attendance_date == today_date)
        .order_by(Attendance.entry_time.asc())
        .all()
    )

    result = []
    for r in records:
        cam = db.query(Camera).filter(Camera.id == r.camera_id).first() if r.camera_id else None
        result.append(AttendanceOut(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user.name,
            role=r.user.role,
            department=r.user.department,
            camera_name=cam.name if cam else "Main Camera",
            location=cam.location if cam else "Main Entrance",
            attendance_date=r.attendance_date,
            entry_time=r.entry_time,
            exit_time=r.exit_time,
            confidence_score=r.confidence_score,
            status=r.status,
        ))
    return result


@router.get("/daily", response_model=List[AttendanceOut])
def get_daily_attendance(
    target_date: Optional[date] = Query(None, description="Date for attendance report (default today)"),
    role: Optional[str] = Query(None, description="Filter by role (Student, Teacher, Employee)"),
    department: Optional[str] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search by person name"),
    db: Session = Depends(get_db),
):
    """Query attendance records for a specific date with filters."""
    query_date = target_date or date.today()
    query = (
        db.query(Attendance)
        .join(User, Attendance.user_id == User.id)
        .filter(Attendance.attendance_date == query_date)
    )

    if role and role.lower() != "all":
        query = query.filter(User.role.ilike(role))
    if department and department.lower() != "all":
        query = query.filter(User.department.ilike(department))
    if search:
        query = query.filter(User.name.ilike(f"%{search.strip()}%"))

    records = query.order_by(Attendance.entry_time.asc()).all()

    result = []
    for r in records:
        cam = db.query(Camera).filter(Camera.id == r.camera_id).first() if r.camera_id else None
        result.append(AttendanceOut(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user.name,
            role=r.user.role,
            department=r.user.department,
            camera_name=cam.name if cam else "Main Camera",
            location=cam.location if cam else "Campus",
            attendance_date=r.attendance_date,
            entry_time=r.entry_time,
            exit_time=r.exit_time,
            confidence_score=r.confidence_score,
            status=r.status,
        ))
    return result


@router.get("/monthly", response_model=List[MonthlyAttendanceItem])
def get_monthly_attendance(
    year: int = Query(..., description="Year (e.g. 2026)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    role: Optional[str] = Query(None, description="Filter by role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db),
):
    """
    Generate monthly attendance summary: days present per person in the given month.
    """
    users_query = db.query(User).filter(User.is_active == True)
    if role and role.lower() != "all":
        users_query = users_query.filter(User.role.ilike(role))
    if department and department.lower() != "all":
        users_query = users_query.filter(User.department.ilike(department))

    users = users_query.order_by(User.name.asc()).all()
    results = []

    for u in users:
        # Count distinct days present in month
        count = (
            db.query(func.count(Attendance.id))
            .filter(
                Attendance.user_id == u.id,
                extract("year", Attendance.attendance_date) == year,
                extract("month", Attendance.attendance_date) == month,
            )
            .scalar() or 0
        )

        # Get first and last attendance in this month
        first_att = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == u.id,
                extract("year", Attendance.attendance_date) == year,
                extract("month", Attendance.attendance_date) == month,
            )
            .order_by(Attendance.attendance_date.asc())
            .first()
        )

        last_att = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == u.id,
                extract("year", Attendance.attendance_date) == year,
                extract("month", Attendance.attendance_date) == month,
            )
            .order_by(Attendance.attendance_date.desc())
            .first()
        )

        results.append(MonthlyAttendanceItem(
            user_id=u.id,
            name=u.name,
            role=u.role,
            department=u.department,
            days_present=count,
            first_seen=first_att.attendance_date.isoformat() if first_att else None,
            last_seen=last_att.attendance_date.isoformat() if last_att else None,
        ))

    return results


@router.get("/export")
def export_attendance_csv(
    target_date: Optional[date] = Query(None, description="Date to export (default today)"),
    db: Session = Depends(get_db),
):
    """Export daily attendance records to a downloadable CSV spreadsheet."""
    query_date = target_date or date.today()
    records = (
        db.query(Attendance)
        .join(User, Attendance.user_id == User.id)
        .filter(Attendance.attendance_date == query_date)
        .order_by(Attendance.entry_time.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Person Name", "Role", "Department", "Date", "Entry Time", "Exit Time",
        "Camera", "Location", "Confidence Score", "Status"
    ])

    for r in records:
        cam = db.query(Camera).filter(Camera.id == r.camera_id).first() if r.camera_id else None
        writer.writerow([
            r.user.name,
            r.user.role,
            r.user.department,
            r.attendance_date.isoformat(),
            r.entry_time.strftime("%I:%M:%S %p") if r.entry_time else "",
            r.exit_time.strftime("%I:%M:%S %p") if r.exit_time else "",
            cam.name if cam else "Main Camera",
            cam.location if cam else "Campus",
            f"{int(r.confidence_score * 100)}%",
            r.status,
        ])

    output.seek(0)
    filename = f"attendance_{query_date.isoformat()}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Backward-Compatible Legacy Endpoints ─────────────────────
@router.get("")
async def get_attendance_legacy():
    """Returns today's attendance (compatible with original endpoint)."""
    return {"records": face_service.get_todays_attendance()}


@router.delete("")
async def clear_attendance_legacy():
    """Clear today's attendance log."""
    face_service.clear_attendance()
    return {"status": "cleared"}


@router.delete("/{attendance_id}")
def delete_attendance_record(attendance_id: int, db: Session = Depends(get_db)):
    """Delete a specific attendance record by ID."""
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    db.delete(record)
    db.commit()
    return {"status": "success", "message": f"Attendance record {attendance_id} deleted"}
