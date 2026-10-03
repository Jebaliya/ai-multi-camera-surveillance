from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..face_service import face_service
from ..utils import clean_name, decode_upload_bytes

router = APIRouter(prefix="/api", tags=["registration"])


@router.post("/register")
async def register(name: str = Form(...), image: UploadFile = File(...)):
    name_clean = clean_name(name)
    if not name_clean:
        raise HTTPException(400, "Invalid name")

    raw = await image.read()
    img = decode_upload_bytes(raw)
    if img is None:
        raise HTTPException(400, "Cannot read image")

    feat = face_service.register_face(name_clean, img)
    if feat is None:
        raise HTTPException(400, "No face detected — use a clear frontal photo")

    return {"status": "ok", "name": name_clean}


@router.get("/registered")
async def get_registered():
    return {"names": list(face_service.known_features.keys())}


@router.delete("/registered/{name}")
async def remove_registered(name: str):
    removed = face_service.remove_registered(name)
    if not removed:
        raise HTTPException(404, "Not found")
    return {"status": "removed", "name": name}
