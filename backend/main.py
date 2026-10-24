import os
import time
import uuid
import base64
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from ultralytics import YOLO

# Initialize FastAPI application
app = FastAPI(
    title="RoadVision AI - YOLO11n Inference API",
    description="Backend service for helmet, violation, and number plate detection using trained YOLO11n weights",
    version="1.0.0",
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

@app.on_event("startup")
def load_yolo_model():
    """Load the trained YOLO11n weights at server startup."""
    global model, CLASS_NAMES
    try:
        if MODEL_PATH.exists():
            print(f"[INFO] Loading YOLO11n weights from: {MODEL_PATH}")
            model = YOLO(str(MODEL_PATH))
            if hasattr(model, "names") and model.names:
                CLASS_NAMES = {int(k): str(v) for k, v in model.names.items()}
            print(f"[INFO] Model successfully loaded. Classes: {CLASS_NAMES}")
        else:
            print(f"[WARNING] Model file not found at {MODEL_PATH}. Starting in degraded mode.")
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO model: {e}")


@app.get("/health")
def health_check():
    """Health check endpoint to verify backend status and model readiness."""
    is_ready = model is not None
    return {
        "status": "ok" if is_ready else "degraded",
        "model_loaded": is_ready,
        "model_name": "YOLO11n (Helmet & Number Plate)",
        "model_path": str(MODEL_PATH),
        "device": str(model.device) if model and hasattr(model, "device") else "cpu",
        "classes": list(CLASS_NAMES.values()),
        "timestamp": time.time(),
    }


@app.post("/predict")
async def predict_image(
    file: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.01, le=1.0, description="Confidence threshold"),
    iou: float = Query(0.45, ge=0.01, le=1.0, description="IoU threshold for NMS"),
    imgsz: int = Query(640, ge=320, le=1280, description="Inference image resolution"),
):
    """
    Run YOLO11n object detection on an uploaded traffic/motorcycle image.
    Returns detected objects, bounding boxes, class counts, and annotated image URL.
    """
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOLO11n model is not currently loaded on the backend.",
        )

    # Validate file extension
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image extension '{file_ext}'. Allowed: JPEG, JPG, PNG, WEBP.",
        )

    # Read image contents into memory
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image data.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted image file: {str(e)}",
        )

    height, width = img.shape[:2]

    # Perform YOLO11n inference
    start_time = time.perf_counter()
    try:
        results = model.predict(
            source=img,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
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

    detections = []
    counts = {
        "helmet": 0,
        "no_helmet": 0,
        "number_plate": 0,
        "pillion": 0,
        "rider": 0,
    }

    if result.boxes is not None and len(result.boxes) > 0:
        boxes_xyxy = result.boxes.xyxy.cpu().numpy()
        classes = result.boxes.cls.cpu().numpy().astype(int)
        confidences = result.boxes.conf.cpu().numpy()

        for idx, (box, cls_id, score) in enumerate(zip(boxes_xyxy, classes, confidences)):
            cls_name = CLASS_NAMES.get(int(cls_id), f"class_{cls_id}")
            x1, y1, x2, y2 = map(float, box)

            # Update count
            if cls_name in counts:
                counts[cls_name] += 1
            else:
                counts[cls_name] = counts.get(cls_name, 0) + 1

            detections.append({
                "class_id": int(cls_id),
                "class_name": cls_name,
                "confidence": round(float(score), 4),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            })

    # Render annotated image
    unique_id = uuid.uuid4().hex[:10]
    out_filename = f"annotated_{unique_id}.jpg"
    out_path = RESULTS_DIR / out_filename

    try:
        annotated_bgr = result.plot()
        cv2.imwrite(str(out_path), annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        annotated_url = f"/results/{out_filename}"
    except Exception:
        annotated_url = None

    return {
        "success": True,
        "filename": file.filename or "image.jpg",
        "inference_time_ms": inference_time_ms,
        "image_width": width,
        "image_height": height,
        "annotated_image_url": annotated_url,
        "detections": detections,
        "counts": counts,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
