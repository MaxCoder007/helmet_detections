"""
Violation Association and Recording Service for RoadVision AI.

Coordinates:
1. Spatial context association: Rider + No_Helmet + Number_Plate + OCR.
2. Classification into Case A (Readable), Case B (Unreadable), Case C (Plate Not Detected), Case D (Uncertain).
3. Continuous feed deduplication (live video / video frame throttling).
4. Evidence image cropping & disk persistence.
5. SQLite violation database insertion.
"""

import time
import math
import uuid
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from backend.association import box_center, box_dimensions, calculate_iou
from backend.violation_storage import (
    save_violation_evidence,
    insert_violation_record,
    init_violation_db
)

# In-memory deduplication cache: key -> last_seen_epoch_seconds
# Key can be registration number or spatial track key
_violation_dedup_cache: Dict[str, float] = {}
_spatial_dedup_cache: List[Dict[str, Any]] = []


def clear_dedup_cache():
    """Clear memory deduplication cache (useful for testing)."""
    global _violation_dedup_cache, _spatial_dedup_cache
    _violation_dedup_cache.clear()
    _spatial_dedup_cache.clear()


def is_live_feed_duplicate(
    registration_number: Optional[str],
    rider_bbox: Optional[List[float]],
    helmet_bbox: Optional[List[float]],
    source_reference: Optional[str] = None,
    cooldown_seconds: float = 8.0
) -> bool:
    """
    Prevent duplicate database rows across consecutive frames of live/video feeds.
    1. Plate match within cooldown window -> throttled.
    2. High spatial overlap of rider/helmet bounding box within cooldown window -> throttled.
    """
    now = time.time()

    # Clean expired spatial cache entries
    global _spatial_dedup_cache
    _spatial_dedup_cache = [e for e in _spatial_dedup_cache if now - e["timestamp"] < (cooldown_seconds * 2.0)]

    # 1. Deduplicate by recognized registration number if present
    if registration_number and registration_number != "unreadable":
        plate_key = f"{source_reference or 'feed'}_{registration_number.upper()}"
        last_time = _violation_dedup_cache.get(plate_key, 0.0)
        if now - last_time < cooldown_seconds:
            return True
        _violation_dedup_cache[plate_key] = now

    # 2. Deduplicate by spatial overlap for unreadable/undetected plates
    test_box = rider_bbox or helmet_bbox
    if test_box:
        for entry in _spatial_dedup_cache:
            if (now - entry["timestamp"]) < cooldown_seconds:
                # Same source stream
                if entry.get("source") == (source_reference or "feed"):
                    prev_box = entry.get("bbox")
                    if prev_box and calculate_iou(test_box, prev_box) > 0.45:
                        return True

        # Register this spatial observation
        _spatial_dedup_cache.append({
            "source": source_reference or "feed",
            "bbox": test_box,
            "timestamp": now,
        })

    return False


def is_image_upload_duplicate(
    event_id: str,
    cooldown_seconds: float = 3.0
) -> bool:
    """Idempotency check: prevent duplicate insertion if client retries same image upload immediately."""
    now = time.time()
    last_time = _violation_dedup_cache.get(event_id, 0.0)
    if now - last_time < cooldown_seconds:
        return True
    _violation_dedup_cache[event_id] = now
    return False


def associate_violating_riders(
    detections: List[Dict[str, Any]],
    ocr_plate_results: List[Dict[str, Any]],
    img_width: int,
    img_height: int
) -> List[Dict[str, Any]]:
    """
    Identify distinct no-helmet violation events and establish vehicle/plate association.
    Returns structured violation candidate events.
    """
    riders = [d for d in detections if d.get("class_name") in ("rider", "pillion")]
    no_helmets = [d for d in detections if d.get("class_name") == "no_helmet"]
    helmets = [d for d in detections if d.get("class_name") == "helmet"]

    violation_events = []
    used_no_helmet_indices = set()

    # Step 1: Match no_helmet detections with riders
    for r_idx, r in enumerate(riders):
        r_box = r["bbox"]
        rx1, ry1, rx2, ry2 = r_box
        rw, rh = box_dimensions(r_box)
        rcx, _ = box_center(r_box)

        # Look for headwear inside the top 50% of the rider body
        matched_no_helmet = None
        best_dist = float("inf")
        matched_nh_idx = None

        for nh_idx, nh in enumerate(no_helmets):
            if nh_idx in used_no_helmet_indices:
                continue
            nh_box = nh["bbox"]
            hcx, hcy = box_center(nh_box)

            # Verification that head is in upper portion of rider
            vert_valid = (ry1 - 0.25 * rh) <= hcy <= (ry1 + 0.50 * rh)
            horiz_valid = (rx1 - 0.25 * rw) <= hcx <= (rx2 + 0.25 * rw)

            if vert_valid and horiz_valid:
                dx = abs(hcx - rcx) / rw
                dy = abs(hcy - (ry1 + 0.15 * rh)) / rh
                dist = math.sqrt(dx * dx + dy * dy)
                if dist < best_dist:
                    best_dist = dist
                    matched_no_helmet = nh
                    matched_nh_idx = nh_idx

        if matched_no_helmet is not None:
            used_no_helmet_indices.add(matched_nh_idx)
            violation_events.append({
                "rider": r,
                "no_helmet": matched_no_helmet,
                "rider_bbox": r["bbox"],
                "helmet_bbox": matched_no_helmet["bbox"],
                "helmet_conf": matched_no_helmet.get("confidence", 0.0),
                "is_unseated_head": False,
            })

    # Step 2: Handle any standalone no_helmet heads not enclosed by a rider box (e.g. truncated body)
    for nh_idx, nh in enumerate(no_helmets):
        if nh_idx not in used_no_helmet_indices:
            violation_events.append({
                "rider": None,
                "no_helmet": nh,
                "rider_bbox": None,
                "helmet_bbox": nh["bbox"],
                "helmet_conf": nh.get("confidence", 0.0),
                "is_unseated_head": True,
            })

    # Step 3: Associate each violation event with available number plates
    final_violations = []

    for v_event in violation_events:
        r_box = v_event["rider_bbox"] or v_event["helmet_bbox"]
        rcx, rcy = box_center(r_box)
        rw, rh = box_dimensions(r_box)

        # If no number plates were detected in the whole image -> Case C
        if not ocr_plate_results:
            final_violations.append({
                "case": "Case C",
                "registration_number": None,
                "raw_ocr_text": "",
                "ocr_confidence": None,
                "ocr_status": "plate_not_detected",
                "plate_detection_confidence": None,
                "vehicle_association_status": "unavailable",
                "rider_bbox": v_event["rider_bbox"],
                "plate_bbox": None,
                "helmet_bbox": v_event["helmet_bbox"],
                "plate_info": None,
                "v_event": v_event,
                "notes": "No-helmet violation detected; no motorcycle number plate detected in scene.",
            })
            continue

        # Evaluate candidate plates
        candidate_plates = []
        for p in ocr_plate_results:
            p_box = p.get("plate_bbox")
            if not p_box:
                continue
            pcx, pcy = box_center(p_box)
            pw, ph = box_dimensions(p_box)

            # Heuristic 1: Plate must be below rider head / chest
            if pcy < rcy:
                continue

            # Heuristics 2 & 3: Horizontal deviation and vertical distance
            if v_event["is_unseated_head"]:
                # Standalone head: human torso + motorcycle distance down to plate is ~3 to 4 head heights
                effective_h = max(rh * 3.5, 120.0)
                effective_w = max(rw * 1.8, 60.0)
                dx = abs(pcx - rcx) / effective_w
                dy = (pcy - r_box[3]) / effective_h
                if dx > 1.4 or dy < -0.2 or dy > 2.2:
                    continue
            else:
                effective_h = max(rh, 50.0)
                effective_w = max(rw, 30.0)
                dx = abs(pcx - rcx) / effective_w
                dy = (pcy - r_box[3]) / effective_h
                if dx > 1.3 or dy < -0.7 or dy > 2.0:
                    continue

            cost = math.sqrt((dx * 1.5) ** 2 + max(0.0, dy) ** 2)
            candidate_plates.append((cost, p))

        candidate_plates.sort(key=lambda x: x[0])

        if not candidate_plates:
            # Plates exist in scene, but none in proximity to this rider -> Case C
            final_violations.append({
                "case": "Case C",
                "registration_number": None,
                "raw_ocr_text": "",
                "ocr_confidence": None,
                "ocr_status": "plate_not_detected",
                "plate_detection_confidence": None,
                "vehicle_association_status": "unavailable",
                "rider_bbox": v_event["rider_bbox"],
                "plate_bbox": None,
                "helmet_bbox": v_event["helmet_bbox"],
                "plate_info": None,
                "v_event": v_event,
                "notes": "No-helmet violation detected; motorcycle number plate not located near rider.",
            })
            continue

        best_cost, best_plate = candidate_plates[0]

        # Check ambiguity: competing plates or multiple riders nearby
        is_ambiguous = False
        if len(candidate_plates) > 1:
            second_cost = candidate_plates[1][0]
            if (second_cost - best_cost) < 0.35:
                is_ambiguous = True

        # Check competition: does another violating rider also compete for this plate?
        competing_riders = 0
        for other_v in violation_events:
            if other_v is not v_event:
                o_box = other_v["rider_bbox"] or other_v["helmet_bbox"]
                ocx, ocy = box_center(o_box)
                pcx, pcy = box_center(best_plate["plate_bbox"])
                if abs(pcx - ocx) < max(rw, 60.0):
                    competing_riders += 1
        if competing_riders > 0:
            is_ambiguous = True

        p_reg = best_plate.get("registration_number") or best_plate.get("text")
        p_raw = best_plate.get("raw_ocr_text") or best_plate.get("raw_text") or ""
        p_conf = best_plate.get("ocr_confidence") or best_plate.get("confidence")
        p_status = best_plate.get("status") or best_plate.get("ocr_status")
        p_det_conf = best_plate.get("plate_confidence") or 0.85

        # Determine association and OCR status
        if is_ambiguous or best_cost > 0.90:
            # Case D: Ambiguous association
            assoc_status = "uncertain"
            case_label = "Case D"
            notes = "Plate detected in proximity, but vehicle-to-rider association is ambiguous."
        else:
            assoc_status = "confirmed"
            notes = "Number plate and rider reliably associated by geometric proximity."
            if p_status == "success" and p_reg:
                case_label = "Case A"
            else:
                case_label = "Case B"

        final_ocr_status = "recognized" if (p_status == "success" and p_reg) else "unreadable"

        final_violations.append({
            "case": case_label,
            "registration_number": p_reg if final_ocr_status == "recognized" else None,
            "raw_ocr_text": p_raw,
            "ocr_confidence": p_conf,
            "ocr_status": final_ocr_status,
            "plate_detection_confidence": p_det_conf,
            "vehicle_association_status": assoc_status,
            "rider_bbox": v_event["rider_bbox"],
            "plate_bbox": best_plate.get("plate_bbox"),
            "helmet_bbox": v_event["helmet_bbox"],
            "plate_info": best_plate,
            "v_event": v_event,
            "notes": notes,
        })

    return final_violations


def process_and_record_violations(
    image_bgr: np.ndarray,
    active_detections: List[Dict[str, Any]],
    ocr_plate_results: List[Dict[str, Any]],
    source_type: str = "image",
    source_reference: Optional[str] = None,
    timestamp: Optional[str] = None,
    cooldown_seconds: float = 8.0,
) -> List[Dict[str, Any]]:
    """
    Main entry point:
    1. Associates unhelmeted riders and number plates into violation events.
    2. Runs deduplication for live/video feeds and idempotency for image uploads.
    3. Crops and saves evidence images to disk.
    4. Inserts records into persistent SQLite table 'violations'.
    5. Returns list of created/associated violation records.
    """
    init_violation_db()
    if image_bgr is None or image_bgr.size == 0:
        return []

    h, w = image_bgr.shape[:2]
    now_ts = timestamp or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Associate violations
    violations_found = associate_violating_riders(
        detections=active_detections,
        ocr_plate_results=ocr_plate_results,
        img_width=w,
        img_height=h
    )

    persisted_records = []

    for v in violations_found:
        reg_num = v["registration_number"]
        r_box = v["rider_bbox"]
        h_box = v["helmet_bbox"]
        p_box = v["plate_bbox"]

        # 1. Deduplication check
        if source_type in ("video", "live", "live_video"):
            if is_live_feed_duplicate(
                registration_number=reg_num,
                rider_bbox=r_box,
                helmet_bbox=h_box,
                source_reference=source_reference,
                cooldown_seconds=cooldown_seconds
            ):
                continue
        elif source_type == "image":
            # Idempotency key for image upload
            raw_event_key = f"{source_reference or 'img'}_{str(r_box)}_{str(h_box)}_{str(p_box)}"
            event_hash = hashlib.md5(raw_event_key.encode()).hexdigest()
            if is_image_upload_duplicate(event_hash, cooldown_seconds=3.0):
                continue

        # Generate unique violation identifier
        viol_id = f"viol_{uuid.uuid4().hex[:10]}"
        event_id = f"ev_{uuid.uuid4().hex[:8]}"

        # 2. Save evidence images to disk
        evidence_paths = save_violation_evidence(
            violation_id=viol_id,
            original_bgr=image_bgr,
            rider_bbox=r_box,
            plate_bbox=p_box  # Won't save plate crop if p_box is None
        )

        record_data = {
            "id": viol_id,
            "event_id": event_id,
            "registration_number": reg_num,
            "manual_registration_number": None,
            "raw_ocr_text": v.get("raw_ocr_text", ""),
            "ocr_confidence": v.get("ocr_confidence"),
            "ocr_status": v.get("ocr_status", "plate_not_detected"),
            "plate_detection_confidence": v.get("plate_detection_confidence"),
            "violation_type": "no_helmet",
            "violation_timestamp": now_ts,
            "rider_crop_path": evidence_paths.get("rider_crop_path"),
            "plate_crop_path": evidence_paths.get("plate_crop_path"),
            "original_image_path": evidence_paths.get("original_image_path"),
            "vehicle_association_status": v.get("vehicle_association_status", "unavailable"),
            "review_status": "pending",
            "review_notes": None,
            "reviewed_at": None,
            "source_type": source_type,
            "source_reference": source_reference or "uploaded_image",
            "rider_bbox": r_box,
            "plate_bbox": p_box,
            "helmet_bbox": h_box,
            "notes": v.get("notes", ""),
            "created_at": now_ts,
        }

        # 3. Insert into SQLite
        try:
            insert_violation_record(record_data)
            persisted_records.append(record_data)
        except Exception as e:
            print(f"[ERROR] Failed to persist violation record {viol_id}: {e}")

    return persisted_records
