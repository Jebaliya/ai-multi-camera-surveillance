from fastapi import APIRouter
from pydantic import BaseModel

from ..face_service import face_service
from ..utils import decode_data_url

router = APIRouter(prefix="/api", tags=["recognition"])


class RecognizeRequest(BaseModel):
    image: str  # data URL (base64)


@router.post("/recognize")
async def recognize(payload: RecognizeRequest):
    img = decode_data_url(payload.image)
    if img is None:
        return {"faces": []}

    faces = face_service.recognize_and_log(img)
    return {"faces": faces}
