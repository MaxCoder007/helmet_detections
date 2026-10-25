"""
Persistent Number Plate Violation Register & Evidence Storage for RoadVision AI.

Provides:
1. SQLite database table 'violations' with schema migrations and indexed queries.
2. Structured filesystem evidence storage for original images, rider crops, and plate crops.
3. Path-traversal proof evidence retrieval.
4. Pagination, date-range, and status filtering for violation register queries.
5. Manual verification, registration correction, and human review workflows.
"""

import os
import io
import csv
import sqlite3
import json
import time
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = RESULTS_DIR / "roadvision.db"

EVIDENCE_DIR = RESULTS_DIR / "evidence" / "violations"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    """Open SQLite connection with row factory configured."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_violation_db():
    """Initialize or migrate the 'violations' table in SQLite."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS violations (
                id TEXT PRIMARY KEY,
                event_id TEXT,
                registration_number TEXT,
                manual_registration_number TEXT,
                raw_ocr_text TEXT,
                ocr_confidence REAL,
                ocr_status TEXT NOT NULL,
                plate_detection_confidence REAL,
                violation_type TEXT NOT NULL DEFAULT 'no_helmet',
                violation_timestamp TEXT NOT NULL,
                rider_crop_path TEXT,
                plate_crop_path TEXT,
                original_image_path TEXT,
                vehicle_association_status TEXT NOT NULL DEFAULT 'unavailable',
                review_status TEXT NOT NULL DEFAULT 'pending',
                review_notes TEXT,
                reviewed_at TEXT,
                source_type TEXT NOT NULL DEFAULT 'image',
                source_reference TEXT,
                rider_bbox TEXT,
                plate_bbox TEXT,
                helmet_bbox TEXT,
                notes TEXT,
                created_at TEXT NOT NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_reg_num ON violations(registration_number);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_manual_reg ON violations(manual_registration_number);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_ocr_status ON violations(ocr_status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_review_status ON violations(review_status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_assoc_status ON violations(vehicle_association_status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_timestamp ON violations(violation_timestamp);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_viol_event_id ON violations(event_id);")
        conn.commit()


def sanitize_bbox(bbox: Any, img_w: int, img_h: int) -> Optional[List[int]]:
    """Validate and clamp bounding box [x1, y1, x2, y2] to image bounds."""
    if not bbox or not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return None
    try:
        x1 = int(round(min(float(bbox[0]), float(bbox[2]))))
        y1 = int(round(min(float(bbox[1]), float(bbox[3]))))
        x2 = int(round(max(float(bbox[0]), float(bbox[2]))))
        y2 = int(round(max(float(bbox[1]), float(bbox[3]))))

        # Clamp to bounds
        x1 = max(0, min(img_w - 1, x1))
        y1 = max(0, min(img_h - 1, y1))
        x2 = max(0, min(img_w, x2))
        y2 = max(0, min(img_h, y2))

        if (x2 - x1) <= 2 or (y2 - y1) <= 2:
            return None
        return [x1, y1, x2, y2]
    except Exception:
        return None


def crop_image_region(
    img: np.ndarray,
    bbox: List[int],
    pad_pct_x: float = 0.05,
    pad_pct_y: float = 0.05
) -> Optional[np.ndarray]:
    """Safely extract cropped region with margin padding."""
    if img is None or img.size == 0 or not bbox:
        return None
    h, w = img.shape[:2]
    x1, y1, x2, y2 = bbox

    pad_x = int((x2 - x1) * pad_pct_x)
    pad_y = int((y2 - y1) * pad_pct_y)

    cx1 = max(0, x1 - pad_x)
    cy1 = max(0, y1 - pad_y)
    cx2 = min(w, x2 + pad_x)
    cy2 = min(h, y2 + pad_y)

    if cx2 <= cx1 or cy2 <= cy1:
        return None

    return img[cy1:cy2, cx1:cx2].copy()


def save_violation_evidence(
    violation_id: str,
    original_bgr: np.ndarray,
    rider_bbox: Optional[List[float]] = None,
    plate_bbox: Optional[List[float]] = None,
) -> Dict[str, Optional[str]]:
    """
    Save evidence images to results/evidence/violations/<violation_id>/
    Returns dictionary with relative storage paths or None:
    {
        "original_image_path": str,
        "rider_crop_path": Optional[str],
        "plate_crop_path": Optional[str]
    }
    """
    if original_bgr is None or original_bgr.size == 0:
        return {
            "original_image_path": None,
            "rider_crop_path": None,
            "plate_crop_path": None,
        }

    h, w = original_bgr.shape[:2]
    target_dir = EVIDENCE_DIR / violation_id
    target_dir.mkdir(parents=True, exist_ok=True)

    paths: Dict[str, Optional[str]] = {
        "original_image_path": None,
        "rider_crop_path": None,
        "plate_crop_path": None,
    }

    # 1. Save original image
    try:
        orig_file = target_dir / "original.jpg"
        cv2.imwrite(str(orig_file), original_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        paths["original_image_path"] = f"evidence/violations/{violation_id}/original.jpg"
    except Exception as e:
        print(f"[WARN] Failed to write original evidence image: {e}")

    # 2. Save rider crop if valid
    if rider_bbox:
        clamped_r = sanitize_bbox(rider_bbox, w, h)
        if clamped_r:
            r_crop = crop_image_region(original_bgr, clamped_r, pad_pct_x=0.04, pad_pct_y=0.04)
            if r_crop is not None and r_crop.size > 0:
                try:
                    r_file = target_dir / "rider.jpg"
                    cv2.imwrite(str(r_file), r_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                    paths["rider_crop_path"] = f"evidence/violations/{violation_id}/rider.jpg"
                except Exception as e:
                    print(f"[WARN] Failed to write rider evidence crop: {e}")

    # 3. Save plate crop if valid (DO NOT save if plate was not detected)
    if plate_bbox:
        clamped_p = sanitize_bbox(plate_bbox, w, h)
        if clamped_p:
            p_crop = crop_image_region(original_bgr, clamped_p, pad_pct_x=0.08, pad_pct_y=0.10)
            if p_crop is not None and p_crop.size > 0:
                try:
                    p_file = target_dir / "number_plate.jpg"
                    cv2.imwrite(str(p_file), p_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
                    paths["plate_crop_path"] = f"evidence/violations/{violation_id}/number_plate.jpg"
                except Exception as e:
                    print(f"[WARN] Failed to write number plate evidence crop: {e}")

    return paths


def get_evidence_file_path(violation_id: str, evidence_type: str) -> Optional[Path]:
    """
    Safely resolve evidence file path with strict path-traversal protection.
    Allowed evidence types: 'original', 'rider', 'number_plate'.
    """
    if evidence_type not in ("original", "rider", "number_plate"):
        return None

    # Sanitize violation_id to prevent path traversal
    safe_id = Path(violation_id).name
    if safe_id != violation_id or ".." in violation_id or "/" in violation_id or "\\" in violation_id:
        return None

    filename = f"{evidence_type}.jpg"
    target_path = (EVIDENCE_DIR / safe_id / filename).resolve()

    # Ensure resolved path is strictly within EVIDENCE_DIR
    try:
        if not target_path.is_relative_to(EVIDENCE_DIR.resolve()):
            return None
    except AttributeError:
        # Fallback for Python < 3.9 if applicable
        if str(EVIDENCE_DIR.resolve()) not in str(target_path):
            return None

    if target_path.exists() and target_path.is_file():
        return target_path

    return None


def insert_violation_record(record: Dict[str, Any]) -> str:
    """Insert a single violation record into SQLite database."""
    init_violation_db()

    viol_id = record.get("id") or f"viol_{uuid.uuid4().hex[:12]}"
    created_at = record.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    violation_ts = record.get("violation_timestamp") or created_at

    ocr_conf = record.get("ocr_confidence")
    if ocr_conf is not None:
        try:
            ocr_conf = float(ocr_conf)
        except Exception:
            ocr_conf = None

    plate_conf = record.get("plate_detection_confidence")
    if plate_conf is not None:
        try:
            plate_conf = float(plate_conf)
        except Exception:
            plate_conf = None

    with get_db_connection() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO violations (
                id, event_id, registration_number, manual_registration_number,
                raw_ocr_text, ocr_confidence, ocr_status, plate_detection_confidence,
                violation_type, violation_timestamp, rider_crop_path, plate_crop_path,
                original_image_path, vehicle_association_status, review_status,
                review_notes, reviewed_at, source_type, source_reference,
                rider_bbox, plate_bbox, helmet_bbox, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            viol_id,
            record.get("event_id"),
            record.get("registration_number"),
            record.get("manual_registration_number"),
            record.get("raw_ocr_text", ""),
            ocr_conf,
            record.get("ocr_status", "plate_not_detected"),
            plate_conf,
            record.get("violation_type", "no_helmet"),
            violation_ts,
            record.get("rider_crop_path"),
            record.get("plate_crop_path"),
            record.get("original_image_path"),
            record.get("vehicle_association_status", "unavailable"),
            record.get("review_status", "pending"),
            record.get("review_notes"),
            record.get("reviewed_at"),
            record.get("source_type", "image"),
            record.get("source_reference"),
            json.dumps(record.get("rider_bbox")) if record.get("rider_bbox") else None,
            json.dumps(record.get("plate_bbox")) if record.get("plate_bbox") else None,
            json.dumps(record.get("helmet_bbox")) if record.get("helmet_bbox") else None,
            record.get("notes", ""),
            created_at,
        ))
        conn.commit()

    return viol_id


def list_violations(
    limit: int = 50,
    offset: int = 0,
    registration: Optional[str] = None,
    ocr_status: Optional[str] = None,
    review_status: Optional[str] = None,
    association_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    violation_type: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve filtered, paginated violation records."""
    init_violation_db()

    query = "SELECT * FROM violations WHERE 1=1"
    params: List[Any] = []

    if registration and registration.strip():
        reg_clean = f"%{registration.strip().upper()}%"
        query += " AND (registration_number LIKE ? OR manual_registration_number LIKE ? OR raw_ocr_text LIKE ?)"
        params.extend([reg_clean, reg_clean, reg_clean])

    if ocr_status and ocr_status != "all":
        query += " AND ocr_status = ?"
        params.append(ocr_status)

    if review_status and review_status != "all":
        query += " AND review_status = ?"
        params.append(review_status)

    if association_status and association_status != "all":
        query += " AND vehicle_association_status = ?"
        params.append(association_status)

    if violation_type and violation_type != "all":
        query += " AND violation_type = ?"
        params.append(violation_type)

    if date_from and date_from.strip():
        query += " AND violation_timestamp >= ?"
        params.append(date_from.strip())

    if date_to and date_to.strip():
        query += " AND violation_timestamp <= ?"
        params.append(date_to.strip())

    count_query = f"SELECT COUNT(*) FROM ({query})"
    if limit > 0:
        query += " ORDER BY violation_timestamp DESC, created_at DESC LIMIT ? OFFSET ?"
        params_for_query = list(params) + [limit, offset]
    else:
        query += " ORDER BY violation_timestamp DESC, created_at DESC"
        params_for_query = list(params)

    with get_db_connection() as conn:
        total = conn.execute(count_query, params).fetchone()[0]
        rows = conn.execute(query, params_for_query).fetchall()

    records = []
    for row in rows:
        r = dict(row)
        r["rider_bbox"] = json.loads(r["rider_bbox"]) if r["rider_bbox"] else None
        r["plate_bbox"] = json.loads(r["plate_bbox"]) if r["plate_bbox"] else None
        r["helmet_bbox"] = json.loads(r["helmet_bbox"]) if r["helmet_bbox"] else None
        records.append(r)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": records,
    }


def get_violation(violation_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single violation record by ID."""
    init_violation_db()
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM violations WHERE id = ?", (violation_id,)).fetchone()
        if not row:
            return None
        r = dict(row)
        r["rider_bbox"] = json.loads(r["rider_bbox"]) if r["rider_bbox"] else None
        r["plate_bbox"] = json.loads(r["plate_bbox"]) if r["plate_bbox"] else None
        r["helmet_bbox"] = json.loads(r["helmet_bbox"]) if r["helmet_bbox"] else None
        return r


def update_violation(
    violation_id: str,
    review_status: Optional[str] = None,
    manual_registration_number: Optional[str] = None,
    review_notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Allow authorized manual review:
    - Update review status ('pending', 'reviewed', 'resolved').
    - Correct/assign registration number manually while PRESERVING raw_ocr_text intact.
    - Add reviewer notes and timestamp.
    """
    init_violation_db()
    existing = get_violation(violation_id)
    if not existing:
        return None

    updates = []
    params = []

    if review_status is not None:
        updates.append("review_status = ?")
        params.append(review_status)

    if manual_registration_number is not None:
        clean_manual = manual_registration_number.strip().upper() if manual_registration_number.strip() else None
        updates.append("manual_registration_number = ?")
        params.append(clean_manual)

    if review_notes is not None:
        updates.append("review_notes = ?")
        params.append(review_notes)

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    updates.append("reviewed_at = ?")
    params.append(now_iso)

    params.append(violation_id)

    with get_db_connection() as conn:
        conn.execute(
            f"UPDATE violations SET {', '.join(updates)} WHERE id = ?",
            params
        )
        conn.commit()

    return get_violation(violation_id)


def get_violation_summary_stats() -> Dict[str, Any]:
    """Calculate dynamic dashboard statistics directly from database."""
    init_violation_db()
    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM violations").fetchone()[0]
        
        # Recognized plates: OCR status is recognized or manual number entered
        recognized = conn.execute("""
            SELECT COUNT(*) FROM violations
            WHERE ocr_status = 'recognized' OR (manual_registration_number IS NOT NULL AND manual_registration_number != '')
        """).fetchone()[0]

        # Unidentified vehicles: no registration recognized and no manual number entered
        unidentified = conn.execute("""
            SELECT COUNT(*) FROM violations
            WHERE (registration_number IS NULL OR registration_number = '' OR ocr_status IN ('unreadable', 'plate_not_detected'))
              AND (manual_registration_number IS NULL OR manual_registration_number = '')
        """).fetchone()[0]

        # Pending review
        pending = conn.execute("SELECT COUNT(*) FROM violations WHERE review_status = 'pending'").fetchone()[0]
        reviewed = conn.execute("SELECT COUNT(*) FROM violations WHERE review_status IN ('reviewed', 'resolved')").fetchone()[0]

    return {
        "total_violations": total,
        "recognized_vehicles": recognized,
        "unidentified_vehicles": unidentified,
        "pending_reviews": pending,
        "reviewed_records": reviewed,
    }


def export_violations_csv(records: List[Dict[str, Any]]) -> str:
    """Generate RFC-4180 compliant CSV string for violation records."""
    fieldnames = [
        "id",
        "violation_timestamp",
        "registration_number",
        "manual_registration_number",
        "effective_registration",
        "ocr_status",
        "ocr_confidence",
        "plate_detection_confidence",
        "violation_type",
        "vehicle_association_status",
        "review_status",
        "review_notes",
        "reviewed_at",
        "source_type",
        "source_reference",
        "rider_bbox",
        "plate_bbox",
        "helmet_bbox",
        "notes",
        "created_at",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for r in records:
        effective = r.get("manual_registration_number") or r.get("registration_number") or ""
        row_dict = {
            **r,
            "effective_registration": effective,
            "rider_bbox": json.dumps(r.get("rider_bbox")) if r.get("rider_bbox") else "",
            "plate_bbox": json.dumps(r.get("plate_bbox")) if r.get("plate_bbox") else "",
            "helmet_bbox": json.dumps(r.get("helmet_bbox")) if r.get("helmet_bbox") else "",
        }
        writer.writerow(row_dict)
    return output.getvalue()

