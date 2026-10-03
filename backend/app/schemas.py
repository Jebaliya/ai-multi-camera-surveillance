"""
Pydantic schemas for request validation and API responses.
"""

from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ── User Schemas ─────────────────────────────────────────────
class UserBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "Student"  # Student, Teacher, Employee, Admin
    department: str = "General"


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    id: int
    profile_image: Optional[str] = None
    is_active: bool
    created_at: datetime
    has_embedding: bool = False

    model_config = ConfigDict(from_attributes=True)


# ── Camera Schemas ───────────────────────────────────────────
class CameraBase(BaseModel):
    name: str
    location: str
    rtsp_url: str
    fps: int = 15


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    rtsp_url: Optional[str] = None
    fps: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class CameraOut(CameraBase):
    id: int
    status: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Attendance Schemas ───────────────────────────────────────
class AttendanceOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    role: str
    department: str
    camera_name: Optional[str] = None
    location: Optional[str] = None
    attendance_date: date
    entry_time: time
    exit_time: Optional[time] = None
    confidence_score: float
    status: str

    model_config = ConfigDict(from_attributes=True)


class MonthlyAttendanceItem(BaseModel):
    user_id: int
    name: str
    role: str
    department: str
    days_present: int
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None


# ── Activity Log Schemas ─────────────────────────────────────
class ActivityLogOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    camera_id: Optional[int] = None
    camera_name: Optional[str] = None
    location: str
    timestamp: datetime
    confidence_score: float
    snapshot_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TimelineEvent(BaseModel):
    id: int
    time: str
    date: str
    location: str
    camera_name: str
    confidence_score: float
    snapshot_path: Optional[str] = None


# ── Alert Schemas ────────────────────────────────────────────
class AlertCreate(BaseModel):
    user_id: Optional[int] = None
    alert_type: str
    last_detected_location: Optional[str] = None
    expected_location: Optional[str] = None
    reason: str


class AlertUpdateStatus(BaseModel):
    status: str  # Pending, Acknowledged, Resolved


class AlertOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    alert_type: str
    last_detected_location: Optional[str] = None
    expected_location: Optional[str] = None
    reason: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Dashboard Stats ──────────────────────────────────────────
class DashboardStats(BaseModel):
    total_users: int
    active_cameras: int
    total_cameras: int
    today_attendance_count: int
    pending_alerts_count: int
