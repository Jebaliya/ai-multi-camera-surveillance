"""
Alerts Router:
Endpoints for managing surveillance alerts, reviewing rule triggers,
updating resolution status, and evaluating campus security rules.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import Alert, User
from ..schemas import AlertOut, AlertUpdateStatus
from ..alert_service import alert_service

router = APIRouter(prefix="/api/alerts", tags=["Surveillance Alerts"])


@router.get("", response_model=List[AlertOut])
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Pending, Acknowledged, Resolved)"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    db: Session = Depends(get_db),
):
    """List all surveillance alerts ordered by most recent."""
    query = db.query(Alert)

    if status_filter and status_filter.lower() != "all":
        query = query.filter(Alert.status.ilike(status_filter))

    if alert_type and alert_type.lower() != "all":
        query = query.filter(Alert.alert_type.ilike(alert_type))

    alerts = query.order_by(desc(Alert.created_at)).all()

    result = []
    for a in alerts:
        user_name = a.user.name if a.user else "Unknown Person"
        result.append(AlertOut(
            id=a.id,
            user_id=a.user_id,
            user_name=user_name,
            alert_type=a.alert_type,
            last_detected_location=a.last_detected_location,
            expected_location=a.expected_location,
            reason=a.reason,
            status=a.status,
            created_at=a.created_at,
        ))
    return result


@router.patch("/{alert_id}/status", response_model=AlertOut)
def update_alert_status(
    alert_id: int,
    payload: AlertUpdateStatus,
    db: Session = Depends(get_db),
):
    """Update alert status (e.g. Acknowledge, Resolve)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = payload.status
    db.commit()
    db.refresh(alert)

    user_name = alert.user.name if alert.user else "Unknown Person"
    return AlertOut(
        id=alert.id,
        user_id=alert.user_id,
        user_name=user_name,
        alert_type=alert.alert_type,
        last_detected_location=alert.last_detected_location,
        expected_location=alert.expected_location,
        reason=alert.reason,
        status=alert.status,
        created_at=alert.created_at,
    )


@router.post("/evaluate")
def trigger_rule_evaluation(db: Session = Depends(get_db)):
    """Run active rule evaluation engine and generate any pending alerts."""
    new_alerts = alert_service.evaluate_rules(db=db)
    return {
        "status": "completed",
        "alerts_generated": len(new_alerts),
        "message": f"Evaluated surveillance rules. {len(new_alerts)} new alert(s) generated.",
    }


@router.delete("/{alert_id}", status_code=status.HTTP_200_OK)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """Delete an alert record."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"status": "success", "message": f"Alert {alert_id} deleted"}
