import requests
import json
import cv2
from pathlib import Path

API_URL = "http://127.0.0.1:8000/predict"
TEST_DIR = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images")
VALID_DIR = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/valid/images")
OUTPUT_DIR = Path("scratch/ocr_verification_results")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Select a diverse set of images
candidates = list(TEST_DIR.glob("*.jpg")) + list(VALID_DIR.glob("*.jpg"))

results = []
tested_count = 0

for img_path in candidates:
    if tested_count >= 15:
        break

    with open(img_path, "rb") as f:
        resp = requests.post(
            f"{API_URL}?conf=0.20&imgsz=1280",
            files={"file": (img_path.name, f, "image/jpeg")}
        )

    if resp.status_code != 200:
        continue

    data = resp.json()
    detections = data.get("detections", [])
    plate_dets = [d for d in detections if d.get("class_name") == "number_plate"]
    other_dets = [d for d in detections if d.get("class_name") != "number_plate"]

    # We want a mix of cases: plates detected, multiple plates, and no plates
    has_plates = len(plate_dets) > 0
    has_others = len(other_dets) > 0

    results.append({
        "filename": img_path.name,
        "path": str(img_path),
        "total_detections": len(detections),
        "plate_count": len(plate_dets),
        "plates": [
            {
                "bbox": d.get("bbox"),
                "yolo_conf": d.get("confidence"),
                "ocr": d.get("ocr"),
            }
            for d in plate_dets
        ],
        "other_classes": [d.get("class_name") for d in other_dets],
    })
    tested_count += 1

print(f"Processed {len(results)} sample images through API.")
with open(OUTPUT_DIR / "verification_summary.json", "w") as f:
    json.dump(results, f, indent=2)

for r in results:
    print(f"\n--- Image: {r['filename']} ---")
    print(f"Total objects: {r['total_detections']} (Plates: {r['plate_count']}, Others: {r['other_classes']})")
    for idx, p in enumerate(r['plates']):
        ocr_info = p['ocr'] or {}
        print(f"  Plate #{idx+1}: BBox={p['bbox']}, YOLO Conf={p['yolo_conf']:.2f}")
        print(f"    OCR Status: {ocr_info.get('status')}")
        print(f"    Recognized Text: {ocr_info.get('text')}")
        print(f"    OCR Conf: {ocr_info.get('confidence')}")
        print(f"    Format Valid: {ocr_info.get('format_valid')} ({ocr_info.get('format_type')})")
        print(f"    Raw Text: '{ocr_info.get('raw_text')}'")
