import cv2
from pathlib import Path
import json

art_dir = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json") as f:
    results = json.load(f)

# Scenario 3: 6_jpg
scen3 = results[2]
test_img_path = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")
img = cv2.imread(str(test_img_path))
h, w = img.shape[:2]

colors = {
    "helmet": (52, 211, 153),
    "no_helmet": (113, 113, 248),
    "number_plate": (255, 232, 139),
    "pillion": (252, 171, 240),
    "rider": (250, 165, 96),
}

canvas3 = img.copy()
for d in scen3["detections"]:
    b = [int(round(x)) for x in d["bbox"]]
    cname = d["class_name"]
    conf = d["confidence"]
    col = colors.get(cname, (200, 200, 200))
    cv2.rectangle(canvas3, (b[0], b[1]), (b[2], b[3]), col, 2)
    cv2.putText(canvas3, f"{cname} {conf*100:.1f}%", (b[0], max(12, b[1]-4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, col, 1)

out_scen3 = art_dir / "scenario_3_multi_rider_verified.jpg"
cv2.imwrite(str(out_scen3), canvas3)
print("Saved:", out_scen3)

# Scenario 4: BikesHelmets248 (two riders close together)
scen4 = results[3]
test_img_path4 = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\BikesHelmets248_png.rf.7a098f0ed08009df88b31909fbe8b621.jpg")
img4 = cv2.imread(str(test_img_path4))

canvas4 = img4.copy()
for d in scen4["detections"]:
    b = [int(round(x)) for x in d["bbox"]]
    cname = d["class_name"]
    conf = d["confidence"]
    col = colors.get(cname, (200, 200, 200))
    cv2.rectangle(canvas4, (b[0], b[1]), (b[2], b[3]), col, 2)
    cv2.putText(canvas4, f"{cname} {conf*100:.1f}%", (b[0], max(12, b[1]-4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, col, 1)

out_scen4 = art_dir / "scenario_4_two_close_riders_verified.jpg"
cv2.imwrite(str(out_scen4), canvas4)
print("Saved:", out_scen4)
