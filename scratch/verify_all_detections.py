import requests
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGE_PATH = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images/6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")

url = "http://127.0.0.1:8000/predict"

with open(IMAGE_PATH, "rb") as f:
    files = {"file": (IMAGE_PATH.name, f, "image/jpeg")}
    r = requests.post(url, files=files)

print("HTTP Status Code:", r.status_code)
assert r.status_code == 200, f"Error: {r.text}"
data = r.json()

print("\n--- Pipeline Counts ---")
print("1. Raw YOLO detections (after built-in NMS):", data.get("raw_detections_count"))
print("2. After duplicate suppression:", data.get("after_duplicate_suppression_count"))
print("3. Suppressed duplicates count:", data.get("suppressed_duplicates_count"))
print("4. Suppressed helmet conflicts count:", data.get("suppressed_conflicts_count"))
print("5. Detections returned in API response:", len(data.get("detections", [])))
print("6. Class counts:", data.get("counts"))

print("\n--- All Retained Detections (sent to Frontend Canvas & Table) ---")
for idx, d in enumerate(data.get("detections", [])):
    print(f"#{idx+1:2d} | ID: {d['id']:6s} | Class: {d['class_name']:12s} | Conf: {d['confidence']*100:6.2f}% | BBox: {d['bbox']}")

print("\n--- Removed Duplicates (Explained) ---")
for idx, dup in enumerate(data.get("suppressed_duplicates", [])):
    s = dup["suppressed"]
    ret = dup["retained"]
    print(f"Duplicate #{idx+1}:")
    print(f"  Suppressed: {s['id']} ({s['class_name']}, {s['confidence']*100:.2f}%) at {s['bbox']}")
    print(f"  Kept Higher Conf: {ret['id']} ({ret['class_name']}, {ret['confidence']*100:.2f}%) at {ret['bbox']}")
    print(f"  Reason: {dup['reason']}")

print("\n--- Resolved Helmet Conflicts (Explained) ---")
for idx, c in enumerate(data.get("resolved_conflicts", [])):
    s = c["suppressed"]
    ret = c["retained"]
    print(f"Conflict #{idx+1}:")
    print(f"  Suppressed: {s['id']} ({s['class_name']}, {s['confidence']*100:.2f}%) at {s['bbox']}")
    print(f"  Kept Higher Conf: {ret['id']} ({ret['class_name']}, {ret['confidence']*100:.2f}%) at {ret['bbox']}")
    print(f"  Reason: {c['reason']}")

with open(BASE_DIR / "scratch" / "final_all_detections_verification.json", "w") as out:
    json.dump(data, out, indent=2)

print("\nSaved verification output to scratch/final_all_detections_verification.json")
