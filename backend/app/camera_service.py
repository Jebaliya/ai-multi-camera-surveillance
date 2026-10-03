"""
CameraService: manages multi-camera RTSP and webcam video streams in background threads.
Performs face detection and recognition on frames, annotates video feeds with
bounding boxes and person identities, and serves real-time MJPEG streams.
"""

import time
import threading
from typing import Dict, Optional, Generator, Tuple
import cv2
import numpy as np

from .face_service import face_service
from .database import SessionLocal
from .models import Camera


class CameraStream:
    """
    Background worker for a single camera source (RTSP URL, webcam index, or video file).
    Continuously grabs the latest frame to prevent RTSP buffer accumulation.
    """

    def __init__(self, camera_id: int, source: str, name: str, location: str, target_fps: int = 15):
        self.camera_id = camera_id
        self.source = source
        self.name = name
        self.location = location
        self.target_fps = max(1, min(30, target_fps))

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()

        self.latest_frame: Optional[np.ndarray] = None
        self.annotated_jpeg: Optional[bytes] = None
        self.is_online = False
        self.last_seen = 0.0

        # Recognition rate limiter (runs recognition every N frames to conserve CPU)
        self.frame_counter = 0
        self.cached_faces: list = []

    def start(self) -> bool:
        """Start the background frame capture thread."""
        if self.is_running:
            return True

        self.is_running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        return True

    def stop(self) -> None:
        """Stop capture thread and release video resource."""
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self._release_cap()

    def _open_cap(self) -> bool:
        """Open the video capture source."""
        self._release_cap()
        try:
            # Check if source is a numeric webcam index (e.g. "0")
            if str(self.source).strip().isdigit():
                src = int(self.source)
                self.cap = cv2.VideoCapture(src, cv2.CAP_DSHOW if cv2.os.name == "nt" else cv2.CAP_ANY)
            else:
                src = str(self.source).strip()
                self.cap = cv2.VideoCapture(src)

            if self.cap and self.cap.isOpened():
                # Set buffer size to 1 to reduce RTSP latency
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                self.is_online = True
                return True
        except Exception as e:
            print(f"[Camera {self.camera_id}] Error opening source {self.source}: {e}")

        self.is_online = False
        return False

    def _release_cap(self) -> None:
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_online = False

    def _capture_loop(self) -> None:
        """Main thread loop: read frames, run face recognition periodically, annotate."""
        reconnect_delay = 5.0
        last_reconnect_attempt = 0.0

        while self.is_running:
            # Reconnect if not opened
            if self.cap is None or not self.cap.isOpened():
                now = time.time()
                if now - last_reconnect_attempt > reconnect_delay:
                    last_reconnect_attempt = now
                    print(f"[Camera {self.camera_id} - {self.name}] Connecting to source: {self.source}...")
                    self._open_cap()
                time.sleep(0.5)
                continue

            success, frame = self.cap.read()
            if not success or frame is None:
                # Video ended or stream dropped
                print(f"[Camera {self.camera_id}] Frame read failed. Reconnecting...")
                self._release_cap()
                time.sleep(1.0)
                continue

            self.last_seen = time.time()
            self.is_online = True
            self.frame_counter += 1

            # Run face recognition every 5 frames (~3 times per sec at 15 FPS)
            if self.frame_counter % 5 == 0:
                try:
                    # Run detection & recognition and persist attendance/activity in DB
                    db = SessionLocal()
                    try:
                        self.cached_faces = face_service.recognize_and_log(
                            img=frame,
                            camera_id=self.camera_id,
                            location=self.location,
                            db=db,
                        )
                    finally:
                        db.close()
                except Exception as err:
                    print(f"[Camera {self.camera_id}] Recognition error: {err}")

            # Annotate frame with bounding boxes and names
            display_frame = frame.copy()
            for face in self.cached_faces:
                name = face["name"]
                score = face["score"]
                left, top, right, bottom = face["left"], face["top"], face["right"], face["bottom"]
                is_known = (name != "Unknown")

                # Color: Teal for registered faces, Rose for unknown
                color = (74, 222, 128) if is_known else (113, 113, 248)  # BGR

                # Draw bounding box
                cv2.rectangle(display_frame, (left, top), (right, bottom), color, 2)

                # Label tag
                label = f"{name} ({int(score * 100)}%)" if is_known else "Unknown"
                font_scale = 0.55
                thickness = 1
                (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
                cv2.rectangle(
                    display_frame,
                    (left, max(0, top - h - 8)),
                    (left + w + 6, max(0, top)),
                    color,
                    -1,
                )
                cv2.putText(
                    display_frame,
                    label,
                    (left + 3, max(h + 2, top - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    font_scale,
                    (10, 14, 19),  # Dark text
                    thickness,
                    cv2.LINE_AA,
                )

            # Camera name overlay at top-left
            cv2.putText(
                display_frame,
                f"CAM: {self.name} | {self.location}",
                (12, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (45, 212, 191),
                1,
                cv2.LINE_AA,
            )

            # Encode frame to JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
            ret, buffer = cv2.imencode(".jpg", display_frame, encode_param)
            if ret:
                with self.lock:
                    self.annotated_jpeg = buffer.tobytes()
                    self.latest_frame = frame

            # Regulate frame rate
            time.sleep(1.0 / self.target_fps)

        self._release_cap()


class CameraService:
    """
    Registry and lifecycle manager for all camera streams in the application.
    """

    def __init__(self):
        self.streams: Dict[int, CameraStream] = {}

    def get_or_create_stream(self, camera: Camera) -> CameraStream:
        """Retrieve existing stream or start a new background worker for the camera."""
        if camera.id in self.streams:
            stream = self.streams[camera.id]
            # If source or name changed, restart stream
            if stream.source != camera.rtsp_url or stream.location != camera.location:
                stream.stop()
                del self.streams[camera.id]
            else:
                if not stream.is_running:
                    stream.start()
                return stream

        stream = CameraStream(
            camera_id=camera.id,
            source=camera.rtsp_url,
            name=camera.name,
            location=camera.location,
            target_fps=camera.fps or 15,
        )
        stream.start()
        self.streams[camera.id] = stream
        return stream

    def stop_stream(self, camera_id: int) -> None:
        """Stop and remove a camera stream."""
        if camera_id in self.streams:
            self.streams[camera_id].stop()
            del self.streams[camera_id]

    def stop_all(self) -> None:
        """Gracefully terminate all running camera capture threads."""
        for stream in self.streams.values():
            stream.stop()
        self.streams.clear()

    def generate_mjpeg(self, camera: Camera) -> Generator[bytes, None, None]:
        """
        Yields multipart MJPEG frame chunks suitable for StreamingResponse.
        """
        stream = self.get_or_create_stream(camera)
        while True:
            frame_bytes = None
            with stream.lock:
                frame_bytes = stream.annotated_jpeg

            if frame_bytes is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
            time.sleep(1.0 / stream.target_fps)

    @staticmethod
    def test_connection(source: str) -> Tuple[bool, str]:
        """
        Quick probe to check if an RTSP URL or webcam index is accessible.
        """
        try:
            if str(source).strip().isdigit():
                cap = cv2.VideoCapture(int(source), cv2.CAP_DSHOW if cv2.os.name == "nt" else cv2.CAP_ANY)
            else:
                cap = cv2.VideoCapture(str(source).strip())

            if cap is not None and cap.isOpened():
                ret, _ = cap.read()
                cap.release()
                if ret:
                    return True, "Camera connected and frame received successfully."
                return False, "Camera opened but could not read frame."
            return False, "Could not open camera stream source."
        except Exception as e:
            return False, f"Connection failed: {str(e)}"


# Singleton manager
camera_service = CameraService()
