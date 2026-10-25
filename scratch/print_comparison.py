import json

with open('scratch/path_a_jupyter.json') as f:
    a = json.load(f)
with open('scratch/path_b_fastapi.json') as f:
    b = json.load(f)

print("=== PATH A (Jupyter conf=0.001, iou=0.70) ===")
print("Total detections:", a["total_detections"])
print("Class counts:", a["class_counts"])
for d in a["detections"]:
    print(f"#{d['index']} {d['class_name']:12} conf={d['confidence']:.4f} bbox={d['bbox']} area={d['area']}")

print("\n=== PATH B (FastAPI conf=0.001, iou=0.45) ===")
print("Raw Count:", b["raw_detections_count"])
print("After Dup Supp Count:", b["after_duplicate_suppression_count"])
print("Final Count:", len(b["final_detections"]))
print("Class counts:", b["class_counts"])
for d in b["final_detections"]:
    print(f"{d['id']} {d['class_name']:12} conf={d['confidence']:.4f} bbox={d['bbox']}")

print(f"\nSuppressed duplicates count: {len(b['suppressed_duplicates'])}")
for s in b['suppressed_duplicates']:
    print("DUP SUPPRESSED:", s["suppressed"]["id"], s["suppressed"]["class_name"], s["suppressed"]["confidence"], "retained:", s["retained"]["id"], "reason:", s["reason"])

print(f"\nResolved conflicts count: {len(b['resolved_conflicts'])}")
for c in b['resolved_conflicts']:
    print("CONFLICT SUPPRESSED:", c["suppressed"]["id"], c["suppressed"]["class_name"], c["suppressed"]["confidence"], "retained:", c["retained"]["id"], "reason:", c["reason"])

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.quality_classifier import classify_detection_quality
validated = classify_detection_quality(b["final_detections"], b["image"]["width"], b["image"]["height"])
print(f"\n=== DETECTION QUALITY CLASSIFICATION ({len(validated)} detections) ===")
for v in validated:
    print(f"{v['id']:6} {v['class_name']:12} conf={v['confidence']:.4f} status={v['quality_status']:20} warnings={v['quality_warnings']}")

