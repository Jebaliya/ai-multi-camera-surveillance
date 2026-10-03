"""
Smart Alert Service:
Rule-based surveillance alert evaluation engine.
Evaluates movement patterns (e.g. Bus -> Classroom missing alerts)
and logs actionable alerts to the database.
"""

from datetime import datetime, timedelta, date
from typing import List, Optional
from sqlalchemy.orm import Session

from .models import Alert, ActivityLog, User, Camera
from .database import SessionLocal


class AlertService:
    def __init__(self):
        # Default expected transit time threshold in minutes
        self.transit_threshold_minutes = 30

    def evaluate_rules(self, db: Optional[Session] = None) -> List[Alert]:
        """
        Evaluate all active surveillance rules and generate alerts for any anomalies.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        new_alerts = []
        try:
            today = date.today()
            now = datetime.utcnow()
            threshold_time = now - timedelta(minutes=self.transit_threshold_minutes)

            # ── Rule 1: Bus to Classroom Missing Alert ───────────────────
            # Find students detected in Bus CCTV today prior to threshold_time
            bus_logs = (
                db.query(ActivityLog)
                .join(Camera, ActivityLog.camera_id == Camera.id)
                .filter(
                    Camera.name.ilike("%Bus%"),
                    ActivityLog.timestamp >= datetime.combine(today, datetime.min.time()),
                    ActivityLog.timestamp <= threshold_time,
                )
                .all()
            )

            # Check if each student reached a Classroom/Building today after bus sighting
            for blog in bus_logs:
                user_id = blog.user_id
                user = db.query(User).filter(User.id == user_id).first()
                if not user or user.role.lower() != "student":
                    continue

                # Check for subsequent classroom sighting
                classroom_sighting = (
                    db.query(ActivityLog)
                    .join(Camera, ActivityLog.camera_id == Camera.id)
                    .filter(
                        ActivityLog.user_id == user_id,
                        ActivityLog.timestamp > blog.timestamp,
                        (Camera.name.ilike("%Classroom%") | Camera.name.ilike("%Lab%") | Camera.location.ilike("%Classroom%")),
                    )
                    .first()
                )

                if not classroom_sighting:
                    # Check if alert already exists for this user today
                    existing_alert = (
                        db.query(Alert)
                        .filter(
                            Alert.user_id == user_id,
                            Alert.alert_type == "MISSING_IN_CLASS",
                            Alert.created_at >= datetime.combine(today, datetime.min.time()),
                        )
                        .first()
                    )

                    if not existing_alert:
                        bus_cam_name = blog.camera.name if blog.camera else "Bus CCTV"
                        alert = Alert(
                            user_id=user_id,
                            alert_type="MISSING_IN_CLASS",
                            last_detected_location=f"{bus_cam_name} ({blog.location})",
                            expected_location="Classroom A / Campus Building",
                            reason=(
                                f"Student '{user.name}' was detected boarding '{bus_cam_name}' at "
                                f"{blog.timestamp.strftime('%I:%M %p')}, but has not arrived in classroom "
                                f"after {self.transit_threshold_minutes} minutes."
                            ),
                            status="Pending",
                            created_at=now,
                        )
                        db.add(alert)
                        db.commit()
                        db.refresh(alert)
                        new_alerts.append(alert)
                        print(f"[AlertService] Generated Alert: {alert.reason}")

        except Exception as e:
            if db:
                db.rollback()
            print(f"[AlertService] Error during rule evaluation: {e}")
        finally:
            if should_close and db:
                db.close()

        return new_alerts


# Singleton instance
alert_service = AlertService()
