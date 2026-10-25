import sys
from pathlib import Path
import cv2
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def compute_box_metrics(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_w = max(0.0, xB - xA)
    inter_h = max(0.0, yB - yA)
    inter_area = inter_w * inter_h

    boxA_area = max(0.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxB_area = max(0.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    union_area = boxA_area + boxB_area - inter_area
    iou = inter_area / union_area if union_area > 0 else 0.0

    min_area = min(boxA_area, boxB_area)
    containment = inter_area / min_area if min_area > 0 else 0.0

    # Center separation
    wA, hA = boxA[2] - boxA[0], boxA[3] - boxA[1]
    wB, hB = boxB[2] - boxB[0], boxB[3] - boxB[1]
    dx = abs((boxA[0] + boxA[2])/2 - (boxB[0] + boxB[2])/2)
    dy = abs((boxA[1] + boxA[3])/2 - (boxB[1] + boxB[3])/2)
    min_w = min(wA, wB) if min(wA, wB) > 0 else 1.0
    min_h = min(hA, hB) if min(hA, hB) > 0 else 1.0
    rel_dx = dx / min_w
    rel_dy = dy / min_h

    return round(float(iou), 4), round(float(containment), 4), round(float(rel_dx), 4), round(float(rel_dy), 4)

def test_suppress_duplicates(detections):
    sorted_dets = sorted(detections, key=lambda x: x.get("confidence", 0.0), reverse=True)
    retained = []
    suppressed_log = []
    suppressed_indices = set()
    n = len(sorted_dets)

    for i in range(n):
        if i in suppressed_indices:
            continue
        item_a = sorted_dets[i]
        retained.append(item_a)
        cls_a = item_a.get("class_name")
        box_a = item_a.get("bbox")
        conf_a = item_a.get("confidence")

        for j in range(i + 1, n):
            if j in suppressed_indices:
                continue
            item_b = sorted_dets[j]
            cls_b = item_b.get("class_name")
            if cls_a != cls_b:
                continue
            box_b = item_b.get("bbox")
            conf_b = item_b.get("confidence")

            iou, containment, rel_dx, rel_dy = compute_box_metrics(box_a, box_b)
            is_dup = False
            reason = ""

            if cls_a == "number_plate":
                if iou >= 0.35:
                    is_dup = True
                    reason = f"Plate IoU {iou:.2f} >= 0.35"
                elif containment >= 0.50:
                    is_dup = True
                    reason = f"Plate containment {containment:.2f} >= 0.50"
            elif cls_a in ("helmet", "no_helmet"):
                if iou >= 0.40:
                    is_dup = True
                    reason = f"Headwear duplicate: IoU {iou:.2f} >= 0.40"
                elif containment >= 0.55 and rel_dx < 0.35:
                    is_dup = True
                    reason = f"Headwear duplicate: Containment {containment:.2f} >= 0.55, rel_dx {rel_dx:.2f} < 0.35"
                elif containment >= 0.75:
                    is_dup = True
                    reason = f"Headwear duplicate: Containment {containment:.2f} >= 0.75"
            else:
                if iou >= 0.45:
                    is_dup = True
                    reason = f"{cls_a} duplicate: IoU {iou:.2f} >= 0.45"
                elif containment >= 0.65:
                    is_dup = True
                    reason = f"{cls_a} duplicate: Containment {containment:.2f} >= 0.65"

            if is_dup:
                suppressed_indices.add(j)
                suppressed_log.append({
                    "retained": item_a["id"],
                    "suppressed": item_b["id"],
                    "class": cls_a,
                    "reason": reason
                })

    return retained, suppressed_log

def test_resolve_conflicts(detections):
    headwear = [d for d in detections if d.get("class_name") in ("helmet", "no_helmet")]
    other = [d for d in detections if d.get("class_name") not in ("helmet", "no_helmet")]
    if len(headwear) < 2:
        return sorted(detections, key=lambda x: x.get("confidence", 0.0), reverse=True), []

    headwear_sorted = sorted(headwear, key=lambda x: x.get("confidence", 0.0), reverse=True)
    suppressed_indices = set()
    resolved_conflicts = []
    n = len(headwear_sorted)

    for i in range(n):
        if i in suppressed_indices:
            continue
        item_a = headwear_sorted[i]
        cls_a = item_a.get("class_name")
        box_a = item_a.get("bbox")
        conf_a = item_a.get("confidence")

        for j in range(i + 1, n):
            if j in suppressed_indices:
                continue
            item_b = headwear_sorted[j]
            cls_b = item_b.get("class_name")
            if cls_a == cls_b:
                continue
            box_b = item_b.get("bbox")
            conf_b = item_b.get("confidence")

            iou, containment, rel_dx, rel_dy = compute_box_metrics(box_a, box_b)
            is_conflict = False
            reason = ""

            if iou >= 0.40:
                is_conflict = True
                reason = f"Opposing headwear IoU {iou:.2f} >= 0.40"
            elif containment >= 0.55 and rel_dx < 0.35:
                is_conflict = True
                reason = f"Opposing headwear Containment {containment:.2f} >= 0.55, rel_dx {rel_dx:.2f} < 0.35"
            elif containment >= 0.75:
                is_conflict = True
                reason = f"Opposing headwear Containment {containment:.2f} >= 0.75"

            if is_conflict:
                suppressed_indices.add(j)
                resolved_conflicts.append({
                    "retained": item_a["id"],
                    "retained_class": cls_a,
                    "retained_conf": conf_a,
                    "suppressed": item_b["id"],
                    "suppressed_class": cls_b,
                    "suppressed_conf": conf_b,
                    "reason": reason
                })

    retained_headwear = [item for idx, item in enumerate(headwear_sorted) if idx not in suppressed_indices]
    final = other + retained_headwear
    final.sort(key=lambda x: x.get("confidence", 0.0), reverse=True)
    return final, resolved_conflicts

# Test on train-no-helmet-374 (Scenario 1)
model = YOLO("models/best.pt")
p = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg")
img = cv2.imread(str(p))
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

after_dup, sup_log = test_suppress_duplicates(raw)
final, conf_log = test_resolve_conflicts(after_dup)

print(f"Scenario 1: train-no-helmet-374")
print(f"Raw: {len(raw)} -> AfterDup: {len(after_dup)} -> AfterConflict: {len(final)}")
print("Conflicts resolved:")
for c in conf_log:
    print(" ", c)

head_on_person = [d for d in final if d["bbox"][0] > 300 and d["bbox"][2] < 450 and d["bbox"][1] > 50 and d["bbox"][3] < 160]
print(f"\nDetections on the rider's head region:")
for h in head_on_person:
    print(f"  {h['id']}: {h['class_name']} ({h['confidence']*100:.1f}%) bbox={h['bbox']}")
