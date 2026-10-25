import sys
from pathlib import Path
import cv2
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.duplicate_suppressor import suppress_class_duplicates, compute_box_metrics
from backend.conflict_resolver import resolve_helmet_conflicts

model = YOLO("models/best.pt")

test_files = [
    ("1. Single unhelmeted rider", "train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg"),
    ("2. Single helmeted rider", "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg"),
    ("3. Multiple riders in same image", "6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg"),
    ("4. Two riders close together", "BikesHelmets248_png.rf.7a098f0ed08009df88b31909fbe8b621.jpg"),
    ("5. Crowded traffic scene", "IMG_3142_JPG.rf.dc1259582bba1d89dc472e767a198ab8.jpg"),
    ("6. Multiple visible number plates", "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg"),
]

for label, fname in test_files:
    p = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images") / fname
    if not p.exists():
        print(f"File not found: {fname}")
        continue
    img = cv2.imread(str(p))
    h, w = img.shape[:2]
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
    after_dup, sup_log = suppress_class_duplicates(raw)
    after_conflict, conf_log = resolve_helmet_conflicts(after_dup)
    
    print(f"\n==========================================")
    print(f"Scenario: {label}")
    print(f"File: {fname} ({w}x{h})")
    print(f"Raw YOLO (conf>=0.001): {len(raw)}")
    print(f"After duplicate suppression: {len(after_dup)} (Suppressed {len(sup_log)})")
    print(f"After conflict resolution: {len(after_conflict)} (Conflicts resolved: {len(conf_log)})")
    
    headwear = [d for d in after_conflict if d["class_name"] in ("helmet", "no_helmet")]
    riders = [d for d in after_conflict if d["class_name"] in ("rider", "pillion")]
    plates = [d for d in after_conflict if d["class_name"] == "number_plate"]
    
    print(f"Final summary: {len(headwear)} headwear ({sum(1 for x in headwear if x['class_name']=='helmet')} helmets, {sum(1 for x in headwear if x['class_name']=='no_helmet')} no_helmet), {len(riders)} riders/pillions, {len(plates)} plates")
    for d in after_conflict:
        print(f"  {d['id']}: {d['class_name']:12s} ({d['confidence']*100:5.1f}%) bbox={d['bbox']}")
