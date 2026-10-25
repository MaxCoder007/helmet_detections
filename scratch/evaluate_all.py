import os
import sys
import json
import hashlib
import requests
from pathlib import Path
from ultralytics import YOLO
from PIL import Image, ImageOps

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
sys.path.insert(0, str(BASE_DIR))

# Five evaluation images
EVAL_IMAGES = {
    "image_1_multi_bike": Path("G:/My Drive/computervision/Helmet-&-Number-Plate-Detection-2-1/test/images/6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg"),
    "image_2_single_bike": Path("G:/My Drive/computervision/Helmet-&-Number-Plate-Detection-2-1/test/images/155_jpg.rf.2e013a6fffe773a907edb23a59b1e3a4.jpg"),
    "image_3_multi_plates": Path("G:/My Drive/computervision/Helmet-&-Number-Plate-Detection-2-1/test/images/new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg"),
    "image_4_helmeted": Path("G:/My Drive/computervision/Helmet-&-Number-Plate-Detection-2-1/test/images/IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg"),
    "image_5_unhelmeted": Path("G:/My Drive/computervision/Helmet-&-Number-Plate-Detection-2-1/test/images/train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg"),
}

def compute_hash(p: Path):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

model_sha = compute_hash(MODEL_PATH)
CLASS_NAMES = {0: "helmet", 1: "no_helmet", 2: "number_plate", 3: "pillion", 4: "rider"}

# -------------------------------------------------------------
# Part 1: Primary Image - Path A vs Path B (Normal & Debug)
# -------------------------------------------------------------
primary_img_path = EVAL_IMAGES["image_1_multi_bike"]
img_sha = compute_hash(primary_img_path)
pil_img = ImageOps.exif_transpose(Image.open(primary_img_path))
img_w, img_h = pil_img.size

# Run Path A (Jupyter exact)
model_j = YOLO(str(MODEL_PATH))
results_j = model_j.predict(
    source=str(primary_img_path),
    imgsz=1280,
    conf=0.001,
    iou=0.70,
    device="cpu",
    max_det=300,
    verbose=False
)[0]

path_a_dets = []
if results_j.boxes is not None:
    boxes = results_j.boxes.xyxy.cpu().numpy()
    clss = results_j.boxes.cls.cpu().numpy().astype(int)
    confs = results_j.boxes.conf.cpu().numpy()
    for idx, (b, c, s) in enumerate(zip(boxes, clss, confs)):
        x1, y1, x2, y2 = map(float, b)
        path_a_dets.append({
            "index": idx,
            "class_id": int(c),
            "class_name": CLASS_NAMES.get(int(c), f"class_{c}"),
            "confidence": round(float(s), 4),
            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            "width": round(x2 - x1, 1),
            "height": round(y2 - y1, 1),
            "area": round((x2 - x1) * (y2 - y1), 1),
        })

path_a_json = {
    "source": "Path A: Jupyter Notebook",
    "image": {
        "filename": primary_img_path.name,
        "width": img_w,
        "height": img_h,
        "sha256": img_sha,
    },
    "model": {
        "checkpoint_path": str(MODEL_PATH),
        "sha256": model_sha,
        "classes": CLASS_NAMES,
    },
    "parameters": {
        "conf": 0.001,
        "iou": 0.70,
        "imgsz": 1280,
        "max_det": 300,
        "device": "cpu",
    },
    "total_detections": len(path_a_dets),
    "class_counts": {
        c: sum(1 for d in path_a_dets if d["class_name"] == c) for c in CLASS_NAMES.values()
    },
    "detections": path_a_dets,
}

with open(BASE_DIR / "scratch" / "path_a_jupyter.json", "w") as f:
    json.dump(path_a_json, f, indent=2)

# Run Path B Normal Mode
with open(primary_img_path, "rb") as f:
    r_norm = requests.post(
        "http://127.0.0.1:8000/predict?mode=normal&conf=0.25&iou=0.45&imgsz=1280&max_det=300",
        files={"file": (primary_img_path.name, f, "image/jpeg")}
    )
path_b_normal = r_norm.json()

# Run Path B Debug Mode
with open(primary_img_path, "rb") as f:
    r_dbg = requests.post(
        "http://127.0.0.1:8000/predict?mode=debug&conf=0.001&iou=0.45&imgsz=1280&max_det=300",
        files={"file": (primary_img_path.name, f, "image/jpeg")}
    )
path_b_debug = r_dbg.json()

path_b_json = {
    "source": "Path B: FastAPI Endpoint (/predict)",
    "image": {
        "filename": primary_img_path.name,
        "width": img_w,
        "height": img_h,
        "sha256": img_sha,
    },
    "model": {
        "checkpoint_path": str(MODEL_PATH),
        "sha256": model_sha,
        "classes": CLASS_NAMES,
    },
    "normal_mode": {
        "parameters": path_b_normal.get("settings_used"),
        "raw_detections_count": path_b_normal.get("raw_detections_count"),
        "after_duplicate_suppression_count": path_b_normal.get("after_duplicate_suppression_count"),
        "after_conflict_resolution_count": path_b_normal.get("after_conflict_resolution_count"),
        "retained_count": len(path_b_normal.get("detections", [])),
        "class_counts": path_b_normal.get("counts"),
        "quality_summary": path_b_normal.get("quality_summary"),
        "detections": path_b_normal.get("detections"),
    },
    "debug_mode": {
        "parameters": path_b_debug.get("settings_used"),
        "raw_detections_count": path_b_debug.get("raw_detections_count"),
        "after_duplicate_suppression_count": path_b_debug.get("after_duplicate_suppression_count"),
        "after_conflict_resolution_count": path_b_debug.get("after_conflict_resolution_count"),
        "retained_count": len(path_b_debug.get("detections", [])),
        "class_counts": path_b_debug.get("counts"),
        "quality_summary": path_b_debug.get("quality_summary"),
        "detections": path_b_debug.get("detections"),
        "suppressed_duplicates": path_b_debug.get("suppressed_duplicates"),
        "resolved_conflicts": path_b_debug.get("resolved_conflicts"),
        "candidate_trace": path_b_debug.get("candidate_trace"),
    },
}

with open(BASE_DIR / "scratch" / "path_b_fastapi.json", "w") as f:
    json.dump(path_b_json, f, indent=2)

print("Saved scratch/path_a_jupyter.json and scratch/path_b_fastapi.json successfully.")

# -------------------------------------------------------------
# Part 2: Evaluate All 5 Real Dataset Images
# -------------------------------------------------------------
eval_summary = []

for key, img_path in EVAL_IMAGES.items():
    print(f"\nEvaluating {key}: {img_path.name}")
    if not img_path.exists():
        print(f"File not found: {img_path}")
        continue

    # Test in Normal Mode
    with open(img_path, "rb") as f:
        res_norm = requests.post(
            "http://127.0.0.1:8000/predict?mode=normal&conf=0.25&iou=0.45&imgsz=1280&max_det=300",
            files={"file": (img_path.name, f, "image/jpeg")}
        ).json()

    # Test in Debug Mode
    with open(img_path, "rb") as f:
        res_dbg = requests.post(
            "http://127.0.0.1:8000/predict?mode=debug&conf=0.001&iou=0.45&imgsz=1280&max_det=300",
            files={"file": (img_path.name, f, "image/jpeg")}
        ).json()

    eval_summary.append({
        "scenario": key,
        "filename": img_path.name,
        "normal_mode": {
            "retained_detections": len(res_norm.get("detections", [])),
            "counts": res_norm.get("counts", {}),
            "detections": [
                {
                    "class": d["class_name"],
                    "confidence": d["confidence"],
                    "bbox": d["bbox"],
                    "quality_status": d.get("quality_status"),
                }
                for d in res_norm.get("detections", [])
            ],
            "compliance_records": [
                {
                    "plate": r.get("registration_number"),
                    "ocr_status": r.get("ocr_status"),
                    "helmet_status": r.get("helmet_status"),
                    "violation": r.get("violation_candidate"),
                }
                for r in res_norm.get("records", [])
            ]
        },
        "debug_mode": {
            "raw_count": res_dbg.get("raw_detections_count"),
            "after_duplicate_suppression": res_dbg.get("after_duplicate_suppression_count"),
            "after_conflict_resolution": res_dbg.get("after_conflict_resolution_count"),
            "suppressed_duplicates_count": res_dbg.get("suppressed_duplicates_count"),
            "resolved_conflicts_count": res_dbg.get("suppressed_conflicts_count"),
            "quality_summary": res_dbg.get("quality_summary"),
        }
    })

with open(BASE_DIR / "scratch" / "eval_5_images.json", "w") as f:
    json.dump(eval_summary, f, indent=2)

print("\nEvaluated all 5 real images. Saved results to scratch/eval_5_images.json.")
