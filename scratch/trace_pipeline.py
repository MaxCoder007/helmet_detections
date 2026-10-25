import sys
from pathlib import Path
import cv2
from ultralytics import YOLO

# Add root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.duplicate_suppressor import suppress_class_duplicates, compute_box_metrics
from backend.conflict_resolver import resolve_helmet_conflicts

model_path = Path(r"G:\My Drive\helmet-number-plate-detection\models\best.pt")
model = YOLO(str(model_path))

test_img_path = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")

img = cv2.imread(str(test_img_path))
h, w = img.shape[:2]
print(f"Testing image: {test_img_path.name} ({w}x{h})")

# Run model
res = model.predict(source=img, conf=0.001, iou=0.45, imgsz=1280, max_det=300, verbose=False, device="cpu")[0]

raw = []
for idx, (b, c, s) in enumerate(zip(res.boxes.xyxy.cpu().numpy(), res.boxes.cls.cpu().numpy().astype(int), res.boxes.conf.cpu().numpy())):
    raw.append({
        "id": f"det_{idx}",
        "class_id": int(c),
        "class_name": model.names[int(c)],
        "confidence": round(float(s), 4),
        "bbox": [round(float(x), 1) for x in b]
    })

print(f"\n1. Raw YOLO detections: {len(raw)}")
for d in raw:
    print(f"  {d['id']}: {d['class_name']} ({d['confidence']*100:.2f}%) bbox={d['bbox']}")

# Step 2: suppress duplicates
after_dup, sup_log = suppress_class_duplicates(raw)
print(f"\n2. After suppress_class_duplicates: {len(after_dup)} (Suppressed: {len(sup_log)})")
for s in sup_log:
    print(f"  Suppressed {s['suppressed']['id']} ({s['suppressed']['class_name']} {s['suppressed']['confidence']*100:.2f}%) by {s['retained']['id']} - {s['reason']}")

# Step 3: resolve conflicts
after_conflict, conf_log = resolve_helmet_conflicts(after_dup)
print(f"\n3. After resolve_helmet_conflicts: {len(after_conflict)} (Conflicts resolved: {len(conf_log)})")
for c in conf_log:
    print(f"  Resolved conflict: kept {c['retained']['class_name']} ({c['retained']['confidence']*100:.2f}%), suppressed {c['suppressed']['class_name']} ({c['suppressed']['confidence']*100:.2f}%) - {c['reason']}")

print(f"\nFinal detections ({len(after_conflict)}):")
for d in after_conflict:
    print(f"  {d['id']}: {d['class_name']} ({d['confidence']*100:.2f}%) bbox={d['bbox']}")
