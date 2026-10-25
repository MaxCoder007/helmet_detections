import os
import json
import time
import uuid
import base64
import hashlib
from io import BytesIO
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Query, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, Response
import cv2
import numpy as np
import torch
from PIL import Image, ImageOps
from ultralytics import YOLO

from backend.ocr import extract_number_plate_ocr, get_ocr_reader
from backend.association import build_compliance_records
from backend.duplicate_suppressor import suppress_class_duplicates
from backend.conflict_resolver import resolve_helmet_conflicts, draw_annotated_detections
from backend.quality_classifier import classify_detection_quality, compute_box_geometry
from backend.storage import (
    init_db,
    save_compliance_record,
    list_compliance_records,
    get_compliance_record,
    update_review_status,
    delete_compliance_record,
    purge_old_records,
    check_deduplication,
)
from backend.violation_storage import (
    init_violation_db,
    list_violations,
    get_violation,
    update_violation,
    get_violation_summary_stats,
    get_evidence_file_path,
    export_violations_csv,
)
from backend.violation_service import process_and_record_violations

# Initialize FastAPI application
app = FastAPI(
    title="RoadVision AI - Number Plate & Helmet Compliance API",
    description="Backend service for YOLO11n object detection, helmet conflict resolution, OCR plate extraction, and compliance association.",
    version="2.1.0",
)

# Enable CORS for React frontend (Vite default: http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
RESULTS_DIR = BASE_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Mount static directory to serve annotated result images
app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")

# Global model container
model: Optional[YOLO] = None
CLASS_NAMES: Dict[int, str] = {
    0: "helmet",
    1: "no_helmet",
    2: "number_plate",
    3: "pillion",
    4: "rider",
}

def get_model_diagnostics() -> Dict[str, Any]:
    """Calculates model identity, hashes, device, and discovers alternative checkpoints."""
    md5_hash = "not_found"
    sha256_hash = "not_found"
    size_mb = 0.0
    if MODEL_PATH.exists():
        md5 = hashlib.md5()
        sha = hashlib.sha256()
        with open(MODEL_PATH, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                md5.update(chunk)
                sha.update(chunk)
        md5_hash = md5.hexdigest()
        sha256_hash = sha.hexdigest()
        size_mb = round(MODEL_PATH.stat().st_size / (1024 * 1024), 2)

    device_str = "cpu"
    if model and hasattr(model, "device"):
        device_str = str(model.device)
    elif hasattr(torch, "xpu") and torch.xpu.is_available():
        device_str = "xpu:0"

    # Search for alternative checkpoints in parent directories
    available_checkpoints = []
    alt_search_dirs = [
        BASE_DIR / "models",
        BASE_DIR.parent / "computervision" / "runs",
    ]
    for sdir in alt_search_dirs:
        if sdir.exists():
            for pt in sdir.glob("**/best.pt"):
                try:
                    rel = str(pt.relative_to(BASE_DIR.parent))
                except Exception:
                    rel = str(pt)
                available_checkpoints.append({
                    "path": str(pt),
                    "relative_name": rel,
                    "size_mb": round(pt.stat().st_size / (1024 * 1024), 2),
                    "is_active": str(pt.resolve()) == str(MODEL_PATH.resolve()),
                })

    return {
        "model_path": str(MODEL_PATH),
        "model_filename": MODEL_PATH.name,
        "md5": md5_hash,
        "sha256": sha256_hash,
        "size_mb": size_mb,
        "classes": CLASS_NAMES,
        "class_count": len(CLASS_NAMES),
        "device": device_str,
        "torch_version": torch.__version__,
        "available_checkpoints": available_checkpoints,
    }


@app.on_event("startup")
def startup_services():
    """Load the trained YOLO11n weights and initialize database at server startup."""
    global model, CLASS_NAMES
    init_db()
    init_violation_db()

    try:
        if MODEL_PATH.exists():
            diag = get_model_diagnostics()
            print(f"[INFO] Loading YOLO11n weights from: {MODEL_PATH}")
            print(f"[INFO] Checkpoint SHA256: {diag['sha256']}")
            print(f"[INFO] Checkpoint MD5:    {diag['md5']} ({diag['size_mb']} MB)")
            model = YOLO(str(MODEL_PATH))
            if hasattr(model, "names") and model.names:
                CLASS_NAMES = {int(k): str(v) for k, v in model.names.items()}
            print(f"[INFO] Model successfully loaded. Classes: {CLASS_NAMES}")
        else:
            print(f"[WARNING] Model file not found at {MODEL_PATH}. Starting in degraded mode.")
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO model: {e}")

    # Warm up EasyOCR reader asynchronously
    try:
        get_ocr_reader()
    except Exception as e:
        print(f"[WARN] OCR initialization deferred: {e}")


@app.get("/health")
def health_check():
    """Health check endpoint to verify backend status, model readiness, and OCR capability."""
    is_ready = model is not None
    ocr_ready = get_ocr_reader() is not None
    diag = get_model_diagnostics()

    return {
        "status": "ok" if is_ready else "degraded",
        "model_loaded": is_ready,
        "ocr_available": ocr_ready,
        "model_name": "YOLO11n (Low-Confidence & Conflict Resolution Enabled)",
        "model_path": str(MODEL_PATH),
        "sha256": diag["sha256"],
        "device": diag["device"],
        "classes": list(CLASS_NAMES.values()),
        "default_config": {
            "conf": 0.25,
            "min_conf": 0.05,
            "iou": 0.45,
            "imgsz": 1280,
            "max_det": 300,
            "conflict_iou": 0.40,
        },
        "timestamp": time.time(),
    }


@app.get("/diagnostics")
def get_diagnostics():
    """Returns developer diagnostics: checkpoint identity, SHA256, class mapping, and hardware state."""
    diag = get_model_diagnostics()
    return {
        "status": "ok",
        "model": diag,
        "default_config": {
            "conf": 0.25,
            "min_conf": 0.05,
            "iou": 0.45,
            "imgsz": 1280,
            "max_det": 300,
            "conflict_iou": 0.40,
            "conflict_containment": 0.55,
            "headwear_iou": 0.40,
            "headwear_containment": 0.55,
            "duplicate_iou": 0.45,
            "duplicate_containment": 0.65,
            "plate_iou": 0.35,
            "plate_containment": 0.50,
        },
        "supported_resolutions": [640, 1280],
        "hardware_info": {
            "device": diag["device"],
            "torch_version": torch.__version__,
            "xpu_available": hasattr(torch, "xpu") and torch.xpu.is_available(),
            "cuda_available": torch.cuda.is_available(),
        },
        "timestamp": time.time(),
    }


@app.post("/predict")
async def predict_image(
    file: UploadFile = File(...),
    mode: str = Query("normal", description="Operating mode: 'normal' (high precision, filters suspicious geometry) or 'debug' (developer inspection)"),
    conf: float = Query(0.25, ge=0.05, le=1.0, description="Confidence threshold (min: 0.05 / 5%)"),
    iou: float = Query(0.45, ge=0.01, le=1.0, description="IoU threshold for YOLO NMS (default: 0.45)"),
    imgsz: int = Query(1280, ge=320, le=1920, description="Inference image resolution (default: 1280)"),
    max_det: int = Query(300, ge=10, le=1000, description="Maximum detections per image (default: 300)"),
    conflict_iou: float = Query(0.40, ge=0.1, le=1.0, description="IoU threshold for helmet vs no_helmet conflict resolution (default: 0.40)"),
    conflict_containment: float = Query(0.55, ge=0.1, le=1.0, description="Containment threshold for helmet vs no_helmet conflict resolution (default: 0.55)"),
    headwear_iou: float = Query(0.40, ge=0.01, le=1.0, description="IoU threshold for headwear duplicate suppression (default: 0.40)"),
    headwear_containment: float = Query(0.55, ge=0.01, le=1.0, description="Containment threshold for headwear duplicate suppression (default: 0.55)"),
    duplicate_iou: float = Query(0.45, ge=0.01, le=1.0, description="IoU threshold for general class-aware duplicate suppression (default: 0.45)"),
    duplicate_containment: float = Query(0.65, ge=0.01, le=1.0, description="Containment threshold for duplicate suppression (default: 0.65)"),
    plate_iou: float = Query(0.35, ge=0.01, le=1.0, description="IoU threshold for small number_plate duplicate suppression (default: 0.35)"),
    plate_containment: float = Query(0.50, ge=0.01, le=1.0, description="Containment threshold for small number_plate duplicate suppression (default: 0.50)"),
    analysis_type: str = Query("image", description="Analysis context: 'image', 'video', or 'live'"),
    save_record: bool = Query(True, description="Whether to record compliance events to durable SQLite storage"),
):
    """
    Run YOLO11n detection, apply helmet/no-helmet conflict resolution, perform number plate OCR,
    and associate riders with safety compliance records.
    Confidence threshold is strictly enforced to be at or above 5% (0.05).
    """
    # Strict policy: ALWAYS keep confidence threshold at or above 5% (0.05)
    conf = max(0.05, float(conf))
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOLO11n model is not currently loaded on the backend.",
        )

    # Validate file extension
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image extension '{file_ext}'. Allowed: JPEG, JPG, PNG, WEBP, AVIF.",
        )

    # Read image contents into memory and ensure EXIF orientation matches browser
    try:
        contents = await file.read()
        pil_img = Image.open(BytesIO(contents))
        pil_img = ImageOps.exif_transpose(pil_img)
        img_rgb = np.array(pil_img.convert("RGB"))
        img = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        if img is None or img.size == 0:
            raise ValueError("Failed to decode image data.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted image file: {str(e)}",
        )

    height, width = img.shape[:2]

    # Perform YOLO11n inference with configurable low-confidence and NMS parameters
    start_time = time.perf_counter()
    try:
        results = model.predict(
            source=img,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            max_det=max_det,
            verbose=False,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing YOLO11n model: {str(e)}",
        )
    inference_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Process first result item
    result = results[0]

    raw_detections = []
    if result.boxes is not None and len(result.boxes) > 0:
        boxes_xyxy = result.boxes.xyxy.cpu().numpy()
        classes = result.boxes.cls.cpu().numpy().astype(int)
        confidences = result.boxes.conf.cpu().numpy()

        for idx, (box, cls_id, score) in enumerate(zip(boxes_xyxy, classes, confidences)):
            cls_name = CLASS_NAMES.get(int(cls_id), f"class_{cls_id}")
            x1, y1, x2, y2 = map(float, box)

            # Clamp bounding box coordinates strictly within image boundaries
            x1 = max(0.0, min(float(width), x1))
            y1 = max(0.0, min(float(height), y1))
            x2 = max(0.0, min(float(width), x2))
            y2 = max(0.0, min(float(height), y2))

            raw_detections.append({
                "id": f"det_{idx}",
                "class_id": int(cls_id),
                "class_name": cls_name,
                "confidence": round(float(score), 4),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            })

    # Step 2: Class-Aware Duplicate Suppression
    # Suppresses redundant boxes of the identical class (e.g., overlapping number_plate boxes or multiple headwear boxes for the same head)
    after_dup_detections, suppressed_duplicates = suppress_class_duplicates(
        raw_detections,
        plate_iou=plate_iou,
        plate_containment=plate_containment,
        headwear_iou=headwear_iou,
        headwear_containment=headwear_containment,
        general_iou=duplicate_iou,
        general_containment=duplicate_containment,
    )

    # Step 3: Resolve Helmet and No-Helmet Conflicts
    # Compares overlapping opposing headwear boxes (IoU >= conflict_iou or high Containment) and retains the higher-confidence prediction
    filtered_detections, resolved_conflicts = resolve_helmet_conflicts(
        after_dup_detections,
        conflict_iou_threshold=conflict_iou,
        conflict_containment_threshold=conflict_containment,
    )

    # Step 3.5: All-Detections Pipeline
    # All detections returned after class-aware duplicate suppression and helmet conflict resolution
    # are retained without arbitrary confidence or geometry thresholds.
    active_detections = list(filtered_detections)

    # Optional geometry and quality annotations for developer inspection
    all_validated = classify_detection_quality(
        active_detections,
        image_width=width,
        image_height=height,
        confidence_threshold_normal=0.25,
    )

    # Compute raw counts per class (directly from YOLO NMS output)
    raw_counts = {
        "helmet": 0,
        "no_helmet": 0,
        "number_plate": 0,
        "pillion": 0,
        "rider": 0,
    }
    for d in raw_detections:
        cname = d.get("class_name")
        if cname in raw_counts:
            raw_counts[cname] += 1
        else:
            raw_counts[cname] = raw_counts.get(cname, 0) + 1

    # Map candidate status and suppression rationale for complete developer transparency
    dup_suppressed_map = {}
    for sd in suppressed_duplicates:
        supp = sd.get("suppressed", {})
        if supp.get("id"):
            dup_suppressed_map[supp["id"]] = sd.get("reason", "Suppressed by duplicate suppression")

    conflict_suppressed_map = {}
    for rc in resolved_conflicts:
        supp = rc.get("suppressed", {})
        if supp.get("id"):
            conflict_suppressed_map[supp["id"]] = rc.get("reason", "Suppressed by helmet conflict resolution")

    candidate_trace = []
    for d in raw_detections:
        d_id = d.get("id")
        if d_id in dup_suppressed_map:
            candidate_trace.append({
                "id": d_id,
                "class_id": d.get("class_id"),
                "class_name": d.get("class_name"),
                "confidence": d.get("confidence"),
                "bbox": d.get("bbox"),
                "status": "suppressed_duplicate",
                "reason": dup_suppressed_map[d_id],
            })
        elif d_id in conflict_suppressed_map:
            candidate_trace.append({
                "id": d_id,
                "class_id": d.get("class_id"),
                "class_name": d.get("class_name"),
                "confidence": d.get("confidence"),
                "bbox": d.get("bbox"),
                "status": "suppressed_conflict",
                "reason": conflict_suppressed_map[d_id],
            })
        else:
            candidate_trace.append({
                "id": d_id,
                "class_id": d.get("class_id"),
                "class_name": d.get("class_name"),
                "confidence": d.get("confidence"),
                "bbox": d.get("bbox"),
                "status": "retained",
                "reason": f"Retained prediction (conf={d.get('confidence')})",
            })

    # Calculate class counts strictly from the active detections
    counts = {
        "helmet": 0,
        "no_helmet": 0,
        "number_plate": 0,
        "pillion": 0,
        "rider": 0,
    }
    for d in active_detections:
        cname = d.get("class_name")
        if cname in counts:
            counts[cname] += 1
        else:
            counts[cname] = counts.get(cname, 0) + 1

    # Step 4: OCR Extraction for all detected number_plate objects
    ocr_plate_results = []
    for d in active_detections:
        if d.get("class_name") == "number_plate":
            try:
                plate_ocr = extract_number_plate_ocr(img, d["bbox"])
            except Exception as e:
                print(f"[WARN] OCR extraction failed for plate box {d.get('bbox')}: {e}")
                plate_ocr = {
                    "text": None,
                    "confidence": None,
                    "format_valid": None,
                    "status": "error",
                    "format_type": "exception",
                    "raw_text": "",
                    "crop_base64": "",
                    "plate_bbox": d.get("bbox", [0, 0, 0, 0]),
                    "notes": f"OCR processing exception: {str(e)}",
                    "review_required": True,
                    "registration_number": None,
                    "ocr_status": "unreadable",
                    "ocr_confidence": 0.0,
                    "raw_ocr_text": "",
                    "validation_format": "exception",
                }

            # Attach structured OCR result directly to the number_plate detection
            d["ocr"] = {
                "text": plate_ocr.get("text"),
                "confidence": plate_ocr.get("confidence"),
                "format_valid": plate_ocr.get("format_valid"),
                "status": plate_ocr.get("status", "unreadable"),
                "format_type": plate_ocr.get("format_type"),
                "raw_text": plate_ocr.get("raw_text", ""),
                "crop_base64": plate_ocr.get("crop_base64", ""),
            }
            ocr_plate_results.append(plate_ocr)

    # Step 5: Associate helmet status and plates with riders
    compliance_items = build_compliance_records(active_detections, ocr_plate_results, width, height)

    # Step 6: Render annotated image using strictly active detections
    unique_id = uuid.uuid4().hex[:10]
    out_filename = f"annotated_{unique_id}.jpg"
    out_path = RESULTS_DIR / out_filename

    try:
        annotated_bgr = draw_annotated_detections(img, active_detections, low_conf_threshold=0.25)
        cv2.imwrite(str(out_path), annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        annotated_url = f"/results/{out_filename}"
    except Exception as e:
        print(f"[WARN] Failed to write annotated image: {e}")
        annotated_url = None

    timestamp_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Build standardized response records
    final_records = []
    for item in compliance_items:
        p_info = item["plate_info"]
        reg_num = p_info["registration_number"]

        record_id = f"rec_{uuid.uuid4().hex[:12]}"
        formatted_record = {
            "id": record_id,
            "timestamp": timestamp_iso,
            "analysis_type": analysis_type,
            "filename": file.filename or "image.jpg",
            "registration_number": reg_num,
            "ocr_status": p_info["ocr_status"],
            "ocr_confidence": p_info["ocr_confidence"],
            "raw_ocr_text": p_info.get("raw_ocr_text", ""),
            "helmet_status": item["helmet_status"],
            "helmet_confidence": item["helmet_confidence"],
            "association_status": item["association_status"],
            "association_confidence": item.get("association_confidence", 0.0),
            "violation_candidate": item["violation_candidate"],
            "review_required": item["review_required"],
            "review_status": "pending_review",
            "evidence_image_url": annotated_url,
            "plate_crop_base64": p_info.get("crop_base64", ""),
            "plate_bbox": p_info.get("plate_bbox"),
            "rider_bbox": item.get("rider_bbox"),
            "helmet_bbox": item.get("helmet_bbox"),
            "notes": item.get("notes", ""),
        }

        # Deduplication for continuous feeds
        if analysis_type in ("video", "live"):
            is_duplicate = check_deduplication(reg_num, cooldown_seconds=8.0)
            if is_duplicate:
                final_records.append(formatted_record)
                continue

        # Save to durable SQLite storage
        if save_record:
            try:
                save_compliance_record(formatted_record)
            except Exception as e:
                print(f"[WARN] Failed to write compliance record: {e}")

        final_records.append(formatted_record)

    # Record violations in persistent Number Plate Violation Register
    recorded_violations = []
    if save_record:
        try:
            recorded_violations = process_and_record_violations(
                image_bgr=img,
                active_detections=active_detections,
                ocr_plate_results=ocr_plate_results,
                source_type=analysis_type,
                source_reference=file.filename or "image.jpg",
                timestamp=timestamp_iso,
            )
        except Exception as e:
            print(f"[WARN] Failed to record violations in violation register: {e}")

    model_diag = get_model_diagnostics()

    quality_summary = {
        "high_confidence": sum(1 for d in all_validated if d.get("quality_status") == "high_confidence"),
        "low_confidence": sum(1 for d in all_validated if d.get("quality_status") == "low_confidence"),
        "potential_duplicate": sum(1 for d in all_validated if d.get("quality_status") == "potential_duplicate"),
        "suspicious_geometry": sum(1 for d in all_validated if d.get("quality_status") == "suspicious_geometry"),
    }

    return {
        "success": True,
        "mode": mode,
        "filename": file.filename or "image.jpg",
        "timestamp": timestamp_iso,
        "inference_time_ms": inference_time_ms,
        "image_width": width,
        "image_height": height,
        "annotated_image_url": annotated_url,
        "detections": active_detections,
        "all_candidates": all_validated,
        "quality_summary": quality_summary,
        "raw_detections_count": len(raw_detections),
        "after_yolo_nms_count": len(raw_detections),
        "after_duplicate_suppression_count": len(after_dup_detections),
        "after_conflict_resolution_count": len(filtered_detections),
        "suppressed_duplicates_count": len(suppressed_duplicates),
        "suppressed_conflicts_count": len(resolved_conflicts),
        "suppressed_duplicates": suppressed_duplicates,
        "resolved_conflicts": resolved_conflicts,
        "counts": counts,
        "records": final_records,
        "violations": recorded_violations,
        "violations_recorded": len(recorded_violations),
        "candidate_trace": candidate_trace,
        "settings_used": {
            "mode": mode,
            "conf": conf,
            "effective_conf": conf,
            "iou": iou,
            "imgsz": imgsz,
            "max_det": max_det,
            "conflict_iou": conflict_iou,
            "conflict_containment": conflict_containment,
            "headwear_iou": headwear_iou,
            "headwear_containment": headwear_containment,
            "duplicate_iou": duplicate_iou,
            "duplicate_containment": duplicate_containment,
            "plate_iou": plate_iou,
            "plate_containment": plate_containment,
        },
        "diagnostics": {
            "mode": mode,
            "model_sha256": model_diag["sha256"],
            "model_md5": model_diag["md5"],
            "model_filename": model_diag["model_filename"],
            "model_classes": CLASS_NAMES,
            "device": model_diag["device"],
            "input_resolution": [width, height],
            "inference_resolution": imgsz,
            "conf_threshold": conf,
            "effective_conf": conf,
            "iou_threshold": iou,
            "max_det": max_det,
            "conflict_iou": conflict_iou,
            "conflict_containment": conflict_containment,
            "headwear_iou": headwear_iou,
            "headwear_containment": headwear_containment,
            "duplicate_iou": duplicate_iou,
            "duplicate_containment": duplicate_containment,
            "plate_iou": plate_iou,
            "plate_containment": plate_containment,
            "raw_detections_count": len(raw_detections),
            "raw_counts": raw_counts,
            "after_yolo_nms_count": len(raw_detections),
            "after_duplicate_suppression_count": len(after_dup_detections),
            "suppressed_duplicates_count": len(suppressed_duplicates),
            "after_conflict_resolution_count": len(filtered_detections),
            "suppressed_conflicts_count": len(resolved_conflicts),
            "post_processed_count": len(active_detections),
            "post_processed_counts": counts,
            "quality_summary": quality_summary,
            "inference_time_ms": inference_time_ms,
            "candidates": candidate_trace,
        },
    }


# -------------------------------------------------------------
# Durable Records & Human Review Endpoints
# -------------------------------------------------------------

@app.get("/records")
def get_records(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    registration: Optional[str] = Query(None, description="Search by registration number substring"),
    helmet_status: Optional[str] = Query(None, description="Filter by helmet status"),
    review_status: Optional[str] = Query(None, description="Filter by review status"),
    violation_only: bool = Query(False, description="Filter for violation candidates only"),
):
    """Retrieve compliance records with search and pagination."""
    return list_compliance_records(
        limit=limit,
        offset=offset,
        reg_filter=registration,
        helmet_filter=helmet_status,
        review_filter=review_status,
        violation_only=violation_only,
    )


@app.get("/records/{record_id}")
def get_single_record(record_id: str):
    """Retrieve a single compliance record by ID."""
    rec = get_compliance_record(record_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance record '{record_id}' not found."
        )
    return rec


@app.patch("/records/{record_id}/review")
def update_record_review(
    record_id: str,
    payload: Dict[str, Any] = Body(...),
):
    """Update human reviewer status: 'verified_violation', 'compliant', 'dismissed'."""
    new_status = payload.get("review_status")
    notes = payload.get("review_notes")
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field 'review_status' is required.",
        )

    valid_statuses = {"pending_review", "verified_violation", "compliant", "dismissed", "approved", "disapproved"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review_status '{new_status}'. Allowed: {valid_statuses}",
        )

    updated = update_review_status(record_id, new_status, notes)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record '{record_id}' could not be found or updated.",
        )

    return {"success": True, "id": record_id, "review_status": new_status, "notes": notes}


@app.delete("/records/{record_id}")
def delete_record(record_id: str):
    """Delete a compliance record by ID."""
    deleted = delete_compliance_record(record_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record '{record_id}' not found.",
        )
    return {"success": True, "deleted_id": record_id}


@app.delete("/records")
def purge_records(days: int = Query(30, ge=1, le=365)):
    """Apply privacy retention policy: purge records older than specified days."""
    count = purge_old_records(days_retention=days)
    return {"success": True, "purged_count": count, "retention_days": days}


# -------------------------------------------------------------
# Number Plate Violation Register Endpoints
# -------------------------------------------------------------

@app.get("/api/violations")
def get_violation_register(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    registration: Optional[str] = Query(None, description="Search by registration number substring"),
    ocr_status: Optional[str] = Query(None, description="Filter by OCR status ('recognized', 'unreadable', 'plate_not_detected')"),
    review_status: Optional[str] = Query(None, description="Filter by review status ('pending', 'reviewed', 'resolved')"),
    association_status: Optional[str] = Query(None, description="Filter by association status ('confirmed', 'uncertain', 'unavailable')"),
    date_from: Optional[str] = Query(None, description="Filter from ISO timestamp"),
    date_to: Optional[str] = Query(None, description="Filter up to ISO timestamp"),
    violation_type: Optional[str] = Query(None, description="Filter by violation type"),
):
    """Retrieve paginated violation records with comprehensive filtering and summary metrics."""
    data = list_violations(
        limit=limit,
        offset=offset,
        registration=registration,
        ocr_status=ocr_status,
        review_status=review_status,
        association_status=association_status,
        date_from=date_from,
        date_to=date_to,
        violation_type=violation_type,
    )
    data["stats"] = get_violation_summary_stats()
    return data


@app.get("/api/violations/stats")
def get_violation_stats():
    """Get high-level violation metrics for summary cards."""
    return get_violation_summary_stats()


@app.get("/api/violations/export")
def export_violations(
    format: str = Query("csv", pattern="^(csv|json)$", description="Export format: 'csv' or 'json'"),
    registration: Optional[str] = Query(None, description="Search by registration number substring"),
    ocr_status: Optional[str] = Query(None, description="Filter by OCR status ('recognized', 'unreadable', 'plate_not_detected')"),
    review_status: Optional[str] = Query(None, description="Filter by review status ('pending', 'reviewed', 'resolved')"),
    association_status: Optional[str] = Query(None, description="Filter by association status ('confirmed', 'uncertain', 'unavailable')"),
    date_from: Optional[str] = Query(None, description="Filter from ISO timestamp"),
    date_to: Optional[str] = Query(None, description="Filter up to ISO timestamp"),
    violation_type: Optional[str] = Query(None, description="Filter by violation type"),
):
    """
    Export all matching violation records as a downloadable CSV or JSON attachment.
    Supports all filter options (unpaginated full dataset export).
    """
    data = list_violations(
        limit=-1,
        offset=0,
        registration=registration,
        ocr_status=ocr_status,
        review_status=review_status,
        association_status=association_status,
        date_from=date_from,
        date_to=date_to,
        violation_type=violation_type,
    )
    records = data.get("records", [])
    now_str = time.strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        csv_content = export_violations_csv(records)
        filename = f"roadvision_violations_export_{now_str}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )
    else:
        export_payload = {
            "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_records": len(records),
            "records": records,
        }
        json_content = json.dumps(export_payload, indent=2)
        filename = f"roadvision_violations_export_{now_str}.json"
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )


@app.get("/api/violations/{violation_id}/export")
def export_single_violation(
    violation_id: str,
    format: str = Query("json", pattern="^(json|csv)$", description="Export format: 'json' or 'csv'")
):
    """Export single violation record dossier as a downloadable JSON or CSV attachment."""
    viol = get_violation(violation_id)
    if not viol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation record '{violation_id}' not found."
        )

    reg_tag = viol.get("manual_registration_number") or viol.get("registration_number") or violation_id

    if format == "csv":
        csv_content = export_violations_csv([viol])
        filename = f"violation_{reg_tag}_{violation_id}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )
    else:
        json_content = json.dumps(viol, indent=2)
        filename = f"violation_{reg_tag}_{violation_id}.json"
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )


@app.get("/api/violations/{violation_id}")
def get_single_violation(violation_id: str):
    """Retrieve complete details for a single violation record."""
    viol = get_violation(violation_id)
    if not viol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation record '{violation_id}' not found."
        )
    return viol


@app.get("/api/violations/{violation_id}/evidence/{evidence_type}")
def get_violation_evidence_file(violation_id: str, evidence_type: str):
    """
    Controlled evidence image retrieval:
    Allowed evidence types: 'original', 'rider', 'number_plate'.
    Protects against path traversal attacks.
    """
    file_path = get_evidence_file_path(violation_id, evidence_type)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence '{evidence_type}' for violation '{violation_id}' not found."
        )
    return FileResponse(path=str(file_path), media_type="image/jpeg")


@app.patch("/api/violations/{violation_id}")
def update_violation_record(
    violation_id: str,
    payload: Dict[str, Any] = Body(...),
):
    """
    Update human reviewer status and/or correct registration number.
    Preserves original OCR results separately.
    Allowed review statuses: 'pending', 'reviewed', 'resolved'.
    """
    review_status_val = payload.get("review_status")
    manual_reg = payload.get("manual_registration_number")
    notes = payload.get("review_notes")

    if review_status_val is not None:
        valid_statuses = {"pending", "reviewed", "resolved"}
        if review_status_val not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid review_status '{review_status_val}'. Allowed: {valid_statuses}",
            )

    updated = update_violation(
        violation_id=violation_id,
        review_status=review_status_val,
        manual_registration_number=manual_reg,
        review_notes=notes,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation record '{violation_id}' not found or could not be updated."
        )
    return {"success": True, "record": updated}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
