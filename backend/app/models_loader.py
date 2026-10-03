"""
Downloads (if needed) and constructs the OpenCV face detector + recognizer.
"""

import urllib.request
from pathlib import Path

import cv2

from .config import YUNET_URL, SFACE_URL, YUNET_PATH, SFACE_PATH


def download_model(url: str, dest: Path) -> None:
    """Download an ONNX model if it doesn't already exist (or is corrupt)."""
    # A previous run may have left a truncated/corrupt file (e.g. an
    # interrupted download, or an HTML error page saved as .onnx). Both
    # ONNX models here are well over 100KB, so treat anything smaller as
    # invalid and re-download it instead of trusting its mere presence.
    MIN_VALID_SIZE = 100_000  # bytes

    if dest.exists():
        if dest.stat().st_size >= MIN_VALID_SIZE:
            print(f"  OK {dest.name} found")
            return
        print(f"  WARN {dest.name} exists but looks corrupt/incomplete ({dest.stat().st_size} bytes) — re-downloading")
        dest.unlink()

    print(f"  Downloading {dest.name} ...")
    try:
        urllib.request.urlretrieve(url, str(dest))
        size = dest.stat().st_size
        if size < MIN_VALID_SIZE:
            dest.unlink(missing_ok=True)
            raise ValueError(f"downloaded file is too small ({size} bytes) — likely an error page, not the model")
        mb = size / (1024 * 1024)
        print(f"  OK {dest.name} ({mb:.1f} MB)")
    except Exception as e:
        dest.unlink(missing_ok=True)
        print(f"\n  ERR Download failed: {e}")
        print(f"    Manually download from:\n      {url}")
        print(f"    Save to:\n      {dest}")
        raise SystemExit(1)


def init_models() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    """Download models (if needed) and return (detector, recognizer)."""
    download_model(YUNET_URL, YUNET_PATH)
    download_model(SFACE_URL, SFACE_PATH)

    detector = cv2.FaceDetectorYN.create(
        str(YUNET_PATH), "", (320, 320),
        score_threshold=0.6, nms_threshold=0.3, top_k=10,
    )
    recognizer = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")
    print("  OK Models ready")
    return detector, recognizer