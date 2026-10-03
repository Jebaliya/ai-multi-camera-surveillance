"""
FaceService: owns the YuNet detector and SFace recognizer models.
Caches registered people and embeddings in memory for fast real-time matching,
and synchronizes with the PostgreSQL database for persistence.
"""

from datetime import datetime, date
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

import cv2
import numpy as np
from sqlalchemy.orm import Session

from .config import KNOWN_FACES_DIR, COSINE_THRESHOLD, SCORE_UI_MIN, SCORE_UI_MAX
from .models_loader import init_models
from .database import SessionLocal
from .models import User, Attendance, ActivityLog, Camera


class FaceService:
    def __init__(self) -> None:
        self.detector: cv2.FaceDetectorYN | None = None
        self.recognizer: cv2.FaceRecognizerSF | None = None

        # Primary cache: user_id -> {id, name, role, department, feature}
        self.known_people: Dict[int, Dict[str, Any]] = {}
        # Backward-compatible cache: name -> feature vector
        self.known_features: Dict[str, np.ndarray] = {}

        # In-memory attendance cache (fast local fallback)
        self.attendance_log: Dict[str, Dict[str, Any]] = {}

    # ── Lifecycle ────────────────────────────────────────────
    def startup(self) -> None:
        """Initialize AI models and load registered faces from DB and files."""
        self.detector, self.recognizer = init_models()
        self.sync_with_db()

    def sync_with_db(self) -> None:
        """
        Load all active registered users and their face embeddings from PostgreSQL into memory.
        If the database is empty but files exist in known_faces/, import them as default users.
        """
        self.known_people.clear()
        self.known_features.clear()

        db = SessionLocal()
        try:
            users = db.query(User).filter(User.is_active == True).all()
            print(f"[FaceService] Found {len(users)} user(s) in database.")

            # Load users from database
            for u in users:
                if u.face_embedding:
                    try:
                        feat = np.frombuffer(u.face_embedding, dtype=np.float32).reshape(1, 128)
                        self.known_people[u.id] = {
                            "id": u.id,
                            "name": u.name,
                            "role": u.role,
                            "department": u.department,
                            "feature": feat,
                        }
                        self.known_features[u.name] = feat
                    except Exception as err:
                        print(f"  [Warn] Failed loading embedding for user {u.name}: {err}")

            # Legacy file import fallback if database has no users yet
            if len(self.known_people) == 0 and KNOWN_FACES_DIR.exists():
                for p in KNOWN_FACES_DIR.iterdir():
                    if p.suffix.lower() in (".jpg", ".jpeg", ".png"):
                        clean_name = p.stem.replace("_", " ").title()
                        img = cv2.imread(str(p))
                        if img is None:
                            continue
                        feat = self.extract_feature(img)
                        if feat is not None:
                            # Create user record in DB
                            new_user = User(
                                name=clean_name,
                                role="Student",
                                department="General",
                                profile_image=p.name,
                                face_embedding=feat.astype(np.float32).tobytes(),
                                is_active=True,
                            )
                            db.add(new_user)
                            db.commit()
                            db.refresh(new_user)
                            self.known_people[new_user.id] = {
                                "id": new_user.id,
                                "name": new_user.name,
                                "role": new_user.role,
                                "department": new_user.department,
                                "feature": feat,
                            }
                            self.known_features[clean_name] = feat
                            print(f"  Imported legacy face to DB: {clean_name}")

            print(f"[FaceService] Loaded {len(self.known_people)} registered face(s) into memory.")
        except Exception as e:
            print(f"[FaceService] Error loading faces from DB: {e}")
        finally:
            db.close()

    # ── Low-level face ops ───────────────────────────────────
    def extract_feature(self, img: np.ndarray) -> np.ndarray | None:
        """Detect the largest face in image and return its 128-d SFace feature vector."""
        if self.detector is None or self.recognizer is None:
            return None
        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)
        if faces is None or len(faces) == 0:
            return None
        aligned = self.recognizer.alignCrop(img, faces[0])
        return self.recognizer.feature(aligned)

    def detect_all(self, img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect every face in the frame.
        Returns list of dicts: [{feature, left, top, right, bottom}, ...]
        """
        if self.detector is None or self.recognizer is None:
            return []
        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)
        if faces is None:
            return []
        results = []
        for f in faces:
            aligned = self.recognizer.alignCrop(img, f)
            feat = self.recognizer.feature(aligned)
            x, y, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
            results.append({
                "feature": feat,
                "left": max(0, x),
                "top": max(0, y),
                "right": min(w, x + fw),
                "bottom": min(h, y + fh),
            })
        return results

    def match_face(self, feat: np.ndarray) -> Tuple[str, float]:
        """
        Compare feature vector against all registered faces using cosine similarity.
        Returns (name, score). Legacy compatible.
        """
        best_name, best_score = "Unknown", 0.0
        for person in self.known_people.values():
            score = self.recognizer.match(feat, person["feature"], cv2.FaceRecognizerSF_FR_COSINE)
            if score > best_score:
                best_score, best_name = score, person["name"]

        if best_score >= COSINE_THRESHOLD:
            mapped = SCORE_UI_MIN + (
                (best_score - COSINE_THRESHOLD) / (1.0 - COSINE_THRESHOLD)
            ) * (SCORE_UI_MAX - SCORE_UI_MIN)
            return best_name, float(mapped)

        return "Unknown", float(best_score)

    def match_face_detailed(self, feat: np.ndarray) -> Dict[str, Any]:
        """
        Detailed face matching returning user ID, name, role, department, and score.
        """
        best_person = None
        best_score = 0.0

        for person in self.known_people.values():
            score = self.recognizer.match(feat, person["feature"], cv2.FaceRecognizerSF_FR_COSINE)
            if score > best_score:
                best_score = score
                best_person = person

        if best_person and best_score >= COSINE_THRESHOLD:
            mapped = SCORE_UI_MIN + (
                (best_score - COSINE_THRESHOLD) / (1.0 - COSINE_THRESHOLD)
            ) * (SCORE_UI_MAX - SCORE_UI_MIN)
            return {
                "matched": True,
                "user_id": best_person["id"],
                "name": best_person["name"],
                "role": best_person["role"],
                "department": best_person["department"],
                "score": float(mapped),
            }

        return {
            "matched": False,
            "user_id": None,
            "name": "Unknown",
            "role": "Unknown",
            "department": "Unknown",
            "score": float(best_score),
        }

    # ── Registration ──────────────────────────────────────────
    def register_user_face(
        self,
        db: Session,
        name: str,
        img: np.ndarray,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        role: str = "Student",
        department: str = "General",
    ) -> Optional[User]:
        """
        Extract face feature, save image, write user to PostgreSQL, and update cache.
        """
        feat = self.extract_feature(img)
        if feat is None:
            return None

        clean_slug = "".join(c for c in name.lower().replace(" ", "_") if c.isalnum() or c == "_")
        filename = f"{clean_slug}_{int(datetime.utcnow().timestamp())}.jpg"
        file_path = KNOWN_FACES_DIR / filename
        cv2.imwrite(str(file_path), img)

        user = User(
            name=name,
            email=email,
            phone=phone,
            role=role,
            department=department,
            profile_image=filename,
            face_embedding=feat.astype(np.float32).tobytes(),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Update in-memory cache
        self.known_people[user.id] = {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "feature": feat,
        }
        self.known_features[user.name] = feat
        return user

    def delete_user_face(self, db: Session, user_id: int) -> bool:
        """Remove a user from DB, filesystem, and in-memory cache."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        if user.profile_image:
            (KNOWN_FACES_DIR / user.profile_image).unlink(missing_ok=True)

        name = user.name
        db.delete(user)
        db.commit()

        self.known_people.pop(user_id, None)
        self.known_features.pop(name, None)
        self.attendance_log.pop(name, None)
        return True

    # Legacy helper for existing router
    def register_face(self, clean_name: str, img: np.ndarray) -> np.ndarray | None:
        db = SessionLocal()
        try:
            user = self.register_user_face(db=db, name=clean_name, img=img)
            return self.known_features.get(clean_name) if user else None
        finally:
            db.close()

    # Legacy helper for existing router
    def remove_registered(self, name: str) -> bool:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.name == name).first()
            if user:
                return self.delete_user_face(db, user.id)
            return False
        finally:
            db.close()

    # ── Real-time recognition & logging ───────────────────────
    def recognize_and_log(
        self,
        img: np.ndarray,
        camera_id: Optional[int] = None,
        location: str = "Webcam",
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Detect and recognize all faces in the frame.
        Persists attendance and activity logs in the database when a registered person is recognized.
        """
        today_date = date.today()
        now_time = datetime.now().time()
        now_str = datetime.now().strftime("%I:%M:%S %p")
        today_str = today_date.isoformat()

        faces = []
        should_close_db = False
        if db is None:
            db = SessionLocal()
            should_close_db = True

        try:
            for d in self.detect_all(img):
                match = self.match_face_detailed(d["feature"])
                user_id = match["user_id"]
                name = match["name"]
                score = match["score"]

                if match["matched"] and user_id:
                    # 1. Update in-memory log
                    existing = self.attendance_log.get(name)
                    if existing is None or existing["date"] != today_str:
                        self.attendance_log[name] = {
                            "time": now_str,
                            "date": today_str,
                            "score": score,
                            "location": location,
                        }
                    elif score > existing.get("score", 0.0):
                        existing["score"] = score

                    # 2. Persist to PostgreSQL Attendance table
                    try:
                        att = (
                            db.query(Attendance)
                            .filter(
                                Attendance.user_id == user_id,
                                Attendance.attendance_date == today_date,
                            )
                            .first()
                        )
                        if not att:
                            # First sighting today -> set entry_time
                            att = Attendance(
                                user_id=user_id,
                                camera_id=camera_id,
                                attendance_date=today_date,
                                entry_time=now_time,
                                exit_time=now_time,
                                confidence_score=score,
                                status="Present",
                            )
                            db.add(att)
                        else:
                            # Sighted again -> update exit_time and score if higher
                            att.exit_time = now_time
                            if score > att.confidence_score:
                                att.confidence_score = score
                        db.commit()

                        # 3. Log event into ActivityLog (throttled/recorded for movement history)
                        activity = ActivityLog(
                            user_id=user_id,
                            camera_id=camera_id,
                            location=location,
                            timestamp=datetime.utcnow(),
                            confidence_score=score,
                        )
                        db.add(activity)
                        db.commit()
                    except Exception as err:
                        db.rollback()
                        print(f"[FaceService] DB Attendance/Activity write error: {err}")

                faces.append({
                    "name": name,
                    "user_id": user_id,
                    "role": match["role"],
                    "department": match["department"],
                    "score": score,
                    "left": d["left"],
                    "top": d["top"],
                    "right": d["right"],
                    "bottom": d["bottom"],
                })
        finally:
            if should_close_db:
                db.close()

        return faces

    def get_todays_attendance(self) -> List[Dict[str, Any]]:
        """Return today's attendance records (from DB with fallback to memory)."""
        db = SessionLocal()
        try:
            today_date = date.today()
            records = (
                db.query(Attendance)
                .filter(Attendance.attendance_date == today_date)
                .all()
            )
            result = []
            for r in records:
                user = db.query(User).filter(User.id == r.user_id).first()
                cam = db.query(Camera).filter(Camera.id == r.camera_id).first() if r.camera_id else None
                result.append({
                    "id": r.id,
                    "user_id": r.user_id,
                    "name": user.name if user else "Unknown",
                    "role": user.role if user else "Unknown",
                    "department": user.department if user else "General",
                    "camera_name": cam.name if cam else "Webcam",
                    "location": cam.location if cam else "Main Entrance",
                    "date": r.attendance_date.isoformat(),
                    "entry_time": r.entry_time.strftime("%I:%M:%S %p") if r.entry_time else None,
                    "exit_time": r.exit_time.strftime("%I:%M:%S %p") if r.exit_time else None,
                    "time": r.entry_time.strftime("%I:%M:%S %p") if r.entry_time else None,
                    "score": r.confidence_score,
                    "status": r.status,
                })
            result.sort(key=lambda x: x["entry_time"] or "")
            return result
        except Exception:
            # Fallback to in-memory
            today = date.today().isoformat()
            records = [
                {"name": n, "time": i["time"], "date": i["date"], "score": i.get("score", 0.0)}
                for n, i in self.attendance_log.items()
                if i["date"] == today
            ]
            records.sort(key=lambda r: r["time"])
            return records
        finally:
            db.close()

    def clear_attendance(self) -> None:
        """Clear today's attendance log."""
        self.attendance_log.clear()
        db = SessionLocal()
        try:
            db.query(Attendance).filter(Attendance.attendance_date == date.today()).delete()
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


# Singleton instance
face_service = FaceService()
