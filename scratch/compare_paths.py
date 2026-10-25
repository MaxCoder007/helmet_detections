import os
import json
import hashlib
import requests
from pathlib import Path
from ultralytics import YOLO
from PIL import Image, ImageOps
import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
IMAGE_PATH = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images/6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")

# 1. Compute SHA-256 and MD5 of model and image
def compute_hashes(path: Path):
    sha = hashlib.sha256()
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
            md5.update(chunk)
    return sha.hexdigest(), md5.hexdigest(), path.stat().st_size

model_sha, model_md5, model_size = compute_hashes(MODEL_PATH)
image_sha, image_md5, image_size = compute_hashes(IMAGE_PATH)

print(f"Model Checkpoint: {MODEL_PATH}")
print(f"Model SHA-256: {model_sha}")
print(f"Image Path: {IMAGE_PATH}")
print(f"Image SHA-256: {image_sha}")

# Load image using PIL with EXIF transpose as in browser/fastapi
pil_img = Image.open(IMAGE_PATH)
pil_img = ImageOps.exif_transpose(pil_img)
img_w, img_h = pil_img.size

# --- PATH A: Exact Jupyter Notebook Settings ---
# In Jupyter Notebook (Cell 118 of trafficproject (2).ipynb):
# CONFIDENCE_THRESHOLD = 0.001
# results = model.predict(source=image_path, imgsz=1280, conf=CONFIDENCE_THRESHOLD, iou=0.70, device=DEVICE, max_det=300, verbose=False)
CLASS_NAMES = {0: "helmet", 1: "no_helmet", 2: "number_plate", 3: "pillion", 4: "rider"}

model_jupyter = YOLO(str(MODEL_PATH))
results_jupyter = model_jupyter.predict(
    source=str(IMAGE_PATH),
    imgsz=1280,
    conf=0.001,
    iou=0.70,
    device="cpu",
    max_det=300,
    verbose=False,
)
res_j = results_jupyter[0]
path_a_detections = []
if res_j.boxes is not None and len(res_j.boxes) > 0:
    boxes = res_j.boxes.xyxy.cpu().numpy()
    clss = res_j.boxes.cls.cpu().numpy().astype(int)
    confs = res_j.boxes.conf.cpu().numpy()
    for idx, (b, c, s) in enumerate(zip(boxes, clss, confs)):
        x1, y1, x2, y2 = map(float, b)
        path_a_detections.append({
            "index": idx,
            "class_id": int(c),
            "class_name": CLASS_NAMES.get(int(c), f"class_{c}"),
            "confidence": round(float(s), 4),
            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            "width": round(x2 - x1, 1),
            "height": round(y2 - y1, 1),
            "area": round((x2 - x1) * (y2 - y1), 1),
        })

path_a_output = {
    "path": "Path A: Jupyter Notebook",
    "image": {
        "filename": IMAGE_PATH.name,
        "width": img_w,
        "height": img_h,
        "sha256": image_sha,
        "md5": image_md5,
    },
    "model": {
        "checkpoint_path": str(MODEL_PATH),
        "sha256": model_sha,
        "md5": model_md5,
        "classes": CLASS_NAMES,
    },
    "inference_params": {
        "conf": 0.001,
        "iou": 0.70,
        "imgsz": 1280,
        "max_det": 300,
        "device": "cpu",
    },
    "total_detections": len(path_a_detections),
    "class_counts": {
        cls: sum(1 for d in path_a_detections if d["class_name"] == cls)
        for cls in CLASS_NAMES.values()
    },
    "detections": path_a_detections,
}

with open(BASE_DIR / "scratch" / "path_a_jupyter.json", "w") as f:
    json.dump(path_a_output, f, indent=2)

print(f"Path A written to scratch/path_a_jupyter.json ({len(path_a_detections)} detections)")

# --- PATH B: Actual FastAPI Backend Endpoint ---
url = "http://localhost:8000/predict?conf=0.001&iou=0.45&imgsz=1280&max_det=300"
with open(IMAGE_PATH, "rb") as f:
    files = {"file": (IMAGE_PATH.name, f, "image/jpeg")}
    response = requests.post(url, files=files)

if response.status_code == 200:
    path_b_data = response.json()
    path_b_output = {
        "path": "Path B: FastAPI Endpoint (/predict)",
        "status_code": response.status_code,
        "image": {
            "filename": path_b_data.get("filename"),
            "width": path_b_data.get("image_width"),
            "height": path_b_data.get("image_height"),
        },
        "model": {
            "sha256": path_b_data.get("diagnostics", {}).get("model_sha256"),
            "md5": path_b_data.get("diagnostics", {}).get("model_md5"),
            "classes": path_b_data.get("diagnostics", {}).get("model_classes"),
        },
        "inference_params": path_b_data.get("settings_used"),
        "raw_detections_count": path_b_data.get("raw_detections_count"),
        "after_yolo_nms_count": path_b_data.get("after_yolo_nms_count"),
        "after_duplicate_suppression_count": path_b_data.get("after_duplicate_suppression_count"),
        "after_conflict_resolution_count": path_b_data.get("after_conflict_resolution_count"),
        "class_counts": path_b_data.get("counts"),
        "final_detections": path_b_data.get("detections"),
        "candidate_trace": path_b_data.get("candidate_trace"),
        "suppressed_duplicates": path_b_data.get("suppressed_duplicates"),
        "resolved_conflicts": path_b_data.get("resolved_conflicts"),
        "compliance_records": path_b_data.get("records"),
    }
    with open(BASE_DIR / "scratch" / "path_b_fastapi.json", "w") as f:
        json.dump(path_b_output, f, indent=2)
    print(f"Path B written to scratch/path_b_fastapi.json ({len(path_b_data.get('detections', []))} final detections)")
else:
    print(f"Path B request failed with status {response.status_code}: {response.text}")
