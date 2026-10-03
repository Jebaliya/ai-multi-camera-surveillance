"""
SQLAlchemy ORM models for:
- User (ERP people: Students, Teachers, Employees, Admins)
- Camera (CCTV cameras, locations, RTSP URLs)
- Attendance (Daily entry/exit attendance logs)
- ActivityLog (Multi-camera person movement timeline)
- Alert (Rule-based surveillance alerts)
- Admin (System credentials for dashboard login)
"""

from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Float,
    Boolean,
    Date,
    Time,
    DateTime,
    LargeBinary,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    """
    ERP User table: stores profile info and 128-d SFace face embedding.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    role = Column(String(50), nullable=False, default="Student")  # Student, Teacher, Employee, Admin
    department = Column(String(100), nullable=False, default="General")
    profile_image = Column(String(255), nullable=True)  # Filename or path in known_faces/
    face_embedding = Column(LargeBinary, nullable=True)  # 128-d SFace float32 vector serialized as bytes
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    attendance_records = relationship("Attendance", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")


class Camera(Base):
    """
    CCTV Camera configuration and status.
    """
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # e.g., "Bus CCTV", "Classroom A CCTV"
    location = Column(String(150), nullable=False)  # e.g., "College Bus 1", "Classroom A"
    rtsp_url = Column(String(255), nullable=False)  # RTSP URL or device index
    status = Column(String(20), default="offline")  # online, offline, error
    fps = Column(Integer, default=15)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    attendance_records = relationship("Attendance", back_populates="camera")
    activity_logs = relationship("ActivityLog", back_populates="camera")


class Attendance(Base):
    """
    Daily attendance record with first entry time and latest exit time.
    """
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "attendance_date", name="uq_user_attendance_date"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    attendance_date = Column(Date, nullable=False, default=date.today, index=True)
    entry_time = Column(Time, nullable=False)  # First sighting
    exit_time = Column(Time, nullable=True)    # Latest sighting
    confidence_score = Column(Float, default=0.0)
    status = Column(String(20), default="Present")  # Present, Late, Half-day
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="attendance_records")
    camera = relationship("Camera", back_populates="attendance_records")


class ActivityLog(Base):
    """
    Real-time movement log whenever a registered face is detected by any camera.
    """
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True, index=True)
    location = Column(String(150), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    confidence_score = Column(Float, default=0.0)
    snapshot_path = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="activity_logs")
    camera = relationship("Camera", back_populates="activity_logs")


class Alert(Base):
    """
    Smart rule-based alerts triggered by system surveillance rules.
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    alert_type = Column(String(50), nullable=False)  # MISSING_IN_CLASS, UNAUTHORIZED, UNKNOWN_FACE
    last_detected_location = Column(String(150), nullable=True)
    expected_location = Column(String(150), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="Pending")  # Pending, Acknowledged, Resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="alerts")


class Admin(Base):
    """
    System administrator accounts for dashboard login.
    """
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(String(50), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow)
