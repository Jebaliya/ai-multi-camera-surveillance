"""
ERP User Management Router:
Endpoints for managing Students, Teachers, Employees, and Staff.
Handles user registration with face embedding extraction and PostgreSQL persistence.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserOut, UserUpdate
from ..face_service import face_service
from ..utils import decode_upload_bytes, clean_name

router = APIRouter(prefix="/api/users", tags=["ERP Users"])


@router.get("", response_model=List[UserOut])
def list_users(
    role: Optional[str] = Query(None, description="Filter by role (Student, Teacher, Employee, Admin)"),
    department: Optional[str] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    db: Session = Depends(get_db),
):
    """List all ERP users with optional filtering."""
    query = db.query(User).filter(User.is_active == True)

    if role and role.lower() != "all":
        query = query.filter(User.role.ilike(role))

    if department and department.lower() != "all":
        query = query.filter(User.department.ilike(department))

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (User.name.ilike(search_fmt)) |
            (User.email.ilike(search_fmt)) |
            (User.phone.ilike(search_fmt))
        )

    users = query.order_by(User.name.asc()).all()

    # Format response with has_embedding flag
    result = []
    for u in users:
        result.append(UserOut(
            id=u.id,
            name=u.name,
            email=u.email,
            phone=u.phone,
            role=u.role,
            department=u.department,
            profile_image=u.profile_image,
            is_active=u.is_active,
            created_at=u.created_at,
            has_embedding=bool(u.face_embedding is not None),
        ))
    return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    name: str = Form(...),
    role: str = Form("Student"),
    department: str = Form("General"),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Register a new person in ERP.
    Extracts 128-d face embedding via YuNet + SFace and stores in PostgreSQL.
    """
    name_clean = clean_name(name)
    if not name_clean:
        raise HTTPException(status_code=400, detail="Invalid name provided")

    # Read and decode uploaded image
    raw_bytes = await image.read()
    img = decode_upload_bytes(raw_bytes)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image file")

    # Register user and extract face embedding
    user = face_service.register_user_face(
        db=db,
        name=name_clean,
        img=img,
        email=email.strip() if email else None,
        phone=phone.strip() if phone else None,
        role=role.strip(),
        department=department.strip(),
    )

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="No face detected in the photo. Please upload a clear frontal portrait."
        )

    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        department=user.department,
        profile_image=user.profile_image,
        is_active=user.is_active,
        created_at=user.created_at,
        has_embedding=True,
    )


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        department=user.department,
        profile_image=user.profile_image,
        is_active=user.is_active,
        created_at=user.created_at,
        has_embedding=bool(user.face_embedding is not None),
    )


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    name: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Update user information and optionally update their face photo/embedding."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if name:
        user.name = clean_name(name)
    if role:
        user.role = role.strip()
    if department:
        user.department = department.strip()
    if email is not None:
        user.email = email.strip() if email else None
    if phone is not None:
        user.phone = phone.strip() if phone else None

    # If a new photo is uploaded, update face embedding
    if image:
        raw_bytes = await image.read()
        img = decode_upload_bytes(raw_bytes)
        if img is not None:
            feat = face_service.extract_feature(img)
            if feat is not None:
                import numpy as np
                user.face_embedding = feat.astype(np.float32).tobytes()
                # Update memory cache
                face_service.known_people[user.id] = {
                    "id": user.id,
                    "name": user.name,
                    "role": user.role,
                    "department": user.department,
                    "feature": feat,
                }
                face_service.known_features[user.name] = feat

    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        department=user.department,
        profile_image=user.profile_image,
        is_active=user.is_active,
        created_at=user.created_at,
        has_embedding=bool(user.face_embedding is not None),
    )


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user, their face embedding, and stored photo."""
    success = face_service.delete_user_face(db=db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": f"User {user_id} deleted successfully"}
