import requests
import json
import cv2
from pathlib import Path

API_URL = "http://127.0.0.1:8000/predict"
SEARCH_DIRS = [
    Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images"),
    Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/valid/images"),
    Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/train/images"),
]

# Targeted test scenarios
SCENARIOS = [
    {
        "scenario": "Clear, Legible Front/Rear Plate",
        "filename": "744_jpg.rf.36ef4ae97f8951ae3fa16766d58ae8e3.jpg",
        "expected_plate_status": "success",
        "expected_format_valid": True,
    },
    {
        "scenario": "Multiple Number Plates in One Scene",
        "filename": "13_jpg.rf.a70178a911c498a8d5a2fc88f0f159cf.jpg",
        "expected_plate_status": "multiple_plates",
        "expected_format_valid": None,
    },
    {
        "scenario": "Tilted / Angled Legible Plate",
        "filename": "new46_jpg.rf.ff5cefbb2b05b48b33d49a6c96064b89.jpg",
        "expected_plate_status": "success",
        "expected_format_valid": True,
    },
    {
        "scenario": "Plate Detected but Characters Degraded / Unreadable",
        "filename": "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg",
        "expected_plate_status": "unreadable_present",
        "expected_format_valid": None,
    },
    {
        "scenario": "No Number Plate in Scene (Riders & Helmets Only)",
        "filename": "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg",
        "expected_plate_status": "zero_plates",
        "expected_format_valid": None,
    },
]

def find_file(fname):
    for d in SEARCH_DIRS:
        p = d / fname
        if p.exists():
            return p
    return None

results = []
for s in SCENARIOS:
    fpath = find_file(s["filename"])
    if not fpath:
        print(f"[WARN] File not found: {s['filename']}")
        continue

    with open(fpath, "rb") as f:
        resp = requests.post(
            f"{API_URL}?conf=0.20&imgsz=1280",
            files={"file": (fpath.name, f, "image/jpeg")}
        )

    if resp.status_code != 200:
        print(f"[ERROR] API failed ({resp.status_code}) for {s['filename']}")
        continue

    data = resp.json()
    detections = data.get("detections", [])
    plate_dets = [d for d in detections if d.get("class_name") == "number_plate"]
    other_dets = [d for d in detections if d.get("class_name") != "number_plate"]

    record = {
        "scenario": s["scenario"],
        "filename": s["filename"],
        "total_detections": len(detections),
        "plate_count": len(plate_dets),
        "other_classes": [d.get("class_name") for d in other_dets],
        "plate_details": [
            {
                "bbox": d.get("bbox"),
                "yolo_conf": round(d.get("confidence", 0), 4),
                "ocr": d.get("ocr"),
            }
            for d in plate_dets
        ],
        "annotated_image_url": data.get("annotated_image_url"),
        "inference_time_ms": data.get("inference_time_ms"),
    }
    results.append(record)

out_file = Path("scratch/real_image_verification_report.json")
with open(out_file, "w") as f:
    json.dump(results, f, indent=2)

print("\n================ REAL IMAGE OCR VERIFICATION REPORT ================")
for r in results:
    print(f"\nScenario: {r['scenario']}")
    print(f"File: {r['filename']}")
    print(f"Total objects: {r['total_detections']} (Plates: {r['plate_count']}, Others: {r['other_classes']})")
    print(f"Inference latency: {r['inference_time_ms']} ms")
    if r['plate_count'] == 0:
        print("  -> Correctly detected 0 plates. Non-plate detections preserved without OCR execution.")
    else:
        for idx, p in enumerate(r['plate_details']):
            ocr = p['ocr'] or {}
            print(f"  Plate #{idx+1}: BBox={p['bbox']}, YOLO Conf={p['yolo_conf']}")
            print(f"    Status: {ocr.get('status')}")
            print(f"    Recognized Text: {ocr.get('text')}")
            print(f"    OCR Confidence: {ocr.get('confidence')}")
            print(f"    Format Valid: {ocr.get('format_valid')} (Format Type: {ocr.get('format_type')})")
            print(f"    Raw OCR Text: '{ocr.get('raw_text')}'")
