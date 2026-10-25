"""
Durable Storage Module for RoadVision AI using SQLite.

Maintains persistent compliance records, review statuses, and deduplication buffers:
- SQLite table for structured audit records (ID, timestamp, registration number, helmet status, review state)
- Configurable cooldown deduplication for video and live camera feeds
- Retention policy and record purging
- Human-in-the-loop review state management
"""

import sqlite3
import json
import time
import os
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
if is_vercel:
    DB_DIR = Path(tempfile.gettempdir()) / "results"
else:
    DB_DIR = Path(__file__).resolve().parent.parent / "results"

try:
    DB_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    DB_DIR = Path(tempfile.gettempdir()) / "results"
    DB_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DB_DIR / "roadvision.db"

# Memory buffer for live / video deduplication: plate -> last_recorded_timestamp
_dedup_cache: Dict[str, float] = {}

def get_db_connection() -> sqlite3.Connection:
    """Open SQLite connection with row factory configured."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize SQLite database tables if not already present."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS compliance_records (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                analysis_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                registration_number TEXT,
                ocr_status TEXT NOT NULL,
                ocr_confidence REAL NOT NULL,
                raw_ocr_text TEXT,
                helmet_status TEXT NOT NULL,
                helmet_confidence REAL NOT NULL,
                association_status TEXT NOT NULL,
                association_confidence REAL NOT NULL,
                violation_candidate INTEGER NOT NULL,
                review_required INTEGER NOT NULL,
                review_status TEXT NOT NULL DEFAULT 'pending_review',
                review_notes TEXT,
                evidence_image_url TEXT,
                plate_crop_base64 TEXT,
                plate_bbox TEXT,
                rider_bbox TEXT,
                helmet_bbox TEXT,
                notes TEXT
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reg_num ON compliance_records(registration_number);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_helmet_status ON compliance_records(helmet_status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON compliance_records(timestamp);")
        conn.commit()


def check_deduplication(registration_number: Optional[str], cooldown_seconds: float = 8.0) -> bool:
    """
    Check if a registration plate was recorded recently within cooldown window.
    Returns True if record should be throttled/deduplicated, False if allowed.
    """
    if not registration_number or registration_number == "unreadable":
        return False

    now = time.time()
    last_time = _dedup_cache.get(registration_number, 0.0)
    if now - last_time < cooldown_seconds:
        return True

    _dedup_cache[registration_number] = now
    # Clean old cache entries occasionally
    if len(_dedup_cache) > 200:
        for k in list(_dedup_cache.keys()):
            if now - _dedup_cache[k] > 60.0:
                del _dedup_cache[k]

    return False


def save_compliance_record(record: Dict[str, Any]) -> str:
    """Insert a compliance record into the SQLite database."""
    init_db()

    rec_id = record.get("id") or f"rec_{int(time.time() * 1000)}"
    timestamp = record.get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with get_db_connection() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO compliance_records (
                id, timestamp, analysis_type, filename, registration_number,
                ocr_status, ocr_confidence, raw_ocr_text, helmet_status,
                helmet_confidence, association_status, association_confidence,
                violation_candidate, review_required, review_status, review_notes,
                evidence_image_url, plate_crop_base64, plate_bbox, rider_bbox,
                helmet_bbox, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec_id,
            timestamp,
            record.get("analysis_type", "image"),
            record.get("filename", "unknown.jpg"),
            record.get("registration_number"),
            record.get("ocr_status", "unreadable"),
            float(record.get("ocr_confidence", 0.0)),
            record.get("raw_ocr_text", ""),
            record.get("helmet_status", "not_assessed"),
            float(record.get("helmet_confidence", 0.0)),
            record.get("association_status", "uncertain"),
            float(record.get("association_confidence", 0.0)),
            1 if record.get("violation_candidate") else 0,
            1 if record.get("review_required") else 0,
            record.get("review_status", "pending_review"),
            record.get("review_notes", ""),
            record.get("evidence_image_url", ""),
            record.get("plate_crop_base64", ""),
            json.dumps(record.get("plate_bbox")) if record.get("plate_bbox") else None,
            json.dumps(record.get("rider_bbox")) if record.get("rider_bbox") else None,
            json.dumps(record.get("helmet_bbox")) if record.get("helmet_bbox") else None,
            record.get("notes", "")
        ))
        conn.commit()

    return rec_id


def list_compliance_records(
    limit: int = 50,
    offset: int = 0,
    reg_filter: Optional[str] = None,
    helmet_filter: Optional[str] = None,
    review_filter: Optional[str] = None,
    violation_only: bool = False
) -> Dict[str, Any]:
    """Query compliance records with filtering and pagination."""
    init_db()

    query = "SELECT * FROM compliance_records WHERE 1=1"
    params: List[Any] = []

    if reg_filter and reg_filter.strip():
        query += " AND registration_number LIKE ?"
        params.append(f"%{reg_filter.strip().upper()}%")

    if helmet_filter and helmet_filter != "all":
        query += " AND helmet_status = ?"
        params.append(helmet_filter)

    if review_filter and review_filter != "all":
        query += " AND review_status = ?"
        params.append(review_filter)

    if violation_only:
        query += " AND violation_candidate = 1"

    count_query = f"SELECT COUNT(*) FROM ({query})"
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params_for_query = list(params) + [limit, offset]

    with get_db_connection() as conn:
        total = conn.execute(count_query, params).fetchone()[0]
        rows = conn.execute(query, params_for_query).fetchall()

    records = []
    for row in rows:
        r = dict(row)
        r["violation_candidate"] = bool(r["violation_candidate"])
        r["review_required"] = bool(r["review_required"])
        r["plate_bbox"] = json.loads(r["plate_bbox"]) if r["plate_bbox"] else None
        r["rider_bbox"] = json.loads(r["rider_bbox"]) if r["rider_bbox"] else None
        r["helmet_bbox"] = json.loads(r["helmet_bbox"]) if r["helmet_bbox"] else None
        records.append(r)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": records,
    }


def get_compliance_record(record_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single compliance record by ID."""
    init_db()
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM compliance_records WHERE id = ?", (record_id,)).fetchone()
        if not row:
            return None
        r = dict(row)
        r["violation_candidate"] = bool(r["violation_candidate"])
        r["review_required"] = bool(r["review_required"])
        r["plate_bbox"] = json.loads(r["plate_bbox"]) if r["plate_bbox"] else None
        r["rider_bbox"] = json.loads(r["rider_bbox"]) if r["rider_bbox"] else None
        r["helmet_bbox"] = json.loads(r["helmet_bbox"]) if r["helmet_bbox"] else None
        return r


def update_review_status(record_id: str, new_status: str, notes: Optional[str] = None) -> bool:
    """Update human review status ('verified_violation', 'compliant', 'dismissed')."""
    init_db()
    with get_db_connection() as conn:
        if notes is not None:
            cur = conn.execute(
                "UPDATE compliance_records SET review_status = ?, review_notes = ? WHERE id = ?",
                (new_status, notes, record_id)
            )
        else:
            cur = conn.execute(
                "UPDATE compliance_records SET review_status = ? WHERE id = ?",
                (new_status, record_id)
            )
        conn.commit()
        return cur.rowcount > 0


def delete_compliance_record(record_id: str) -> bool:
    """Delete a record by ID."""
    init_db()
    with get_db_connection() as conn:
        cur = conn.execute("DELETE FROM compliance_records WHERE id = ?", (record_id,))
        conn.commit()
        return cur.rowcount > 0


def purge_old_records(days_retention: int = 30) -> int:
    """Apply privacy retention policy: delete records older than X days."""
    init_db()
    cutoff = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ",
        time.gmtime(time.time() - (days_retention * 86400))
    )
    with get_db_connection() as conn:
        cur = conn.execute("DELETE FROM compliance_records WHERE timestamp < ?", (cutoff,))
        conn.commit()
        return cur.rowcount
