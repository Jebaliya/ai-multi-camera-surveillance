"""
Object Tracking:
Lightweight, real-time bounding box IoU tracker.
Associates face detections across video frames with unique track IDs,
stabilizes bounding boxes, and prevents flicker.
"""

from typing import List, Dict, Any, Tuple


def calculate_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    """Calculate Intersection over Union (IoU) between two bounding boxes (left, top, right, bottom)."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    denom = float(boxAArea + boxBArea - interArea)
    if denom <= 0:
        return 0.0
    return interArea / denom


class FaceTracker:
    """
    Multi-face tracker for a single camera feed.
    """

    def __init__(self, iou_threshold: float = 0.3, max_age: int = 15):
        self.iou_threshold = iou_threshold
        self.max_age = max_age
        self.next_track_id = 1
        # track_id -> {box: (l, t, r, b), identity: dict, age: int, missed: int}
        self.tracks: Dict[int, Dict[str, Any]] = {}

    def update(self, detected_faces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Match detected faces to active tracks using IoU.
        Returns list of annotated face objects with track_id.
        """
        # Age existing tracks
        for tid in list(self.tracks.keys()):
            self.tracks[tid]["missed"] += 1
            if self.tracks[tid]["missed"] > self.max_age:
                del self.tracks[tid]

        matched_detections = set()
        matched_tracks = set()

        # Attempt to match existing tracks to detections
        for tid, track in self.tracks.items():
            best_iou = 0.0
            best_det_idx = -1

            for idx, det in enumerate(detected_faces):
                if idx in matched_detections:
                    continue
                det_box = (det["left"], det["top"], det["right"], det["bottom"])
                iou = calculate_iou(track["box"], det_box)
                if iou > best_iou:
                    best_iou = iou
                    best_det_idx = idx

            if best_iou >= self.iou_threshold and best_det_idx != -1:
                matched_tracks.add(tid)
                matched_detections.add(best_det_idx)
                det = detected_faces[best_det_idx]
                det_box = (det["left"], det["top"], det["right"], det["bottom"])

                # Update track with new box
                track["box"] = det_box
                track["missed"] = 0
                if det.get("name") and det["name"] != "Unknown":
                    track["identity"] = det

                det["track_id"] = tid

        # Create new tracks for unmatched detections
        for idx, det in enumerate(detected_faces):
            if idx not in matched_detections:
                tid = self.next_track_id
                self.next_track_id += 1
                det_box = (det["left"], det["top"], det["right"], det["bottom"])
                self.tracks[tid] = {
                    "box": det_box,
                    "identity": det,
                    "missed": 0,
                }
                det["track_id"] = tid

        return detected_faces
