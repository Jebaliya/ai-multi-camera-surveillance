"""Small shared helpers."""

import re
import base64

import cv2
import numpy as np


def clean_name(name: str) -> str:
    """Strip characters that aren't safe for filenames / display."""
    return re.sub(r"[^\w\s-]", "", name).strip()


def decode_upload_bytes(raw: bytes) -> np.ndarray | None:
    """Decode raw image bytes (from an UploadFile) into a BGR numpy array."""
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    return img


def decode_data_url(data_url: str) -> np.ndarray | None:
    """Decode a `data:image/...;base64,...` string into a BGR numpy array."""
    b64 = data_url
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return None
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
