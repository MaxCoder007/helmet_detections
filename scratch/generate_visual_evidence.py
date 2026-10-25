import cv2
from pathlib import Path
import json

art_dir = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")
test_img_path = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg")

img = cv2.imread(str(test_img_path))
h, w = img.shape[:2]

# Load API detections for Scenario 1
with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json") as f:
    results = json.load(f)

scen1 = results[0]
dets = scen1["detections"]

# Draw annotated visualization
canvas = img.copy()
# Draw rider box
for d in dets:
    b = [int(round(x)) for x in d["bbox"]]
    cname = d["class_name"]
    conf = d["confidence"]
    if cname == "rider":
        cv2.rectangle(canvas, (b[0], b[1]), (b[2], b[3]), (250, 165, 96), 2)
        cv2.putText(canvas, f"rider {conf*100:.1f}%", (b[0], b[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (250, 165, 96), 2)
    elif cname == "no_helmet" and b[0] > 300 and b[2] < 450:
        cv2.rectangle(canvas, (b[0], b[1]), (b[2], b[3]), (113, 113, 248), 2)
        cv2.putText(canvas, f"no_helmet {conf*100:.1f}%", (b[0], b[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (113, 113, 248), 2)

out_annotated = art_dir / "unhelmeted_rider_scenario_verified.jpg"
cv2.imwrite(str(out_annotated), canvas)
print("Saved:", out_annotated)

# Crop the rider's head region
# Head box is [344.2, 81.1, 401.5, 142.0]
pad = 20
crop_x1 = max(0, int(344 - pad))
crop_y1 = max(0, int(81 - pad))
crop_x2 = min(w, int(402 + pad))
crop_y2 = min(h, int(142 + pad))
head_crop = img[crop_y1:crop_y2, crop_x1:crop_x2]

# On head crop, draw the single no_helmet box
head_annotated = head_crop.copy()
bx1 = int(344.2 - crop_x1)
by1 = int(81.1 - crop_y1)
bx2 = int(401.5 - crop_x1)
by2 = int(142.0 - crop_y1)
cv2.rectangle(head_annotated, (bx1, by1), (bx2, by2), (113, 113, 248), 2)
cv2.putText(head_annotated, "no_helmet 51.6%", (bx1, max(12, by1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (113, 113, 248), 1)

out_crop = art_dir / "unhelmeted_rider_head_single_detection.jpg"
cv2.imwrite(str(out_crop), head_annotated)
print("Saved:", out_crop)
