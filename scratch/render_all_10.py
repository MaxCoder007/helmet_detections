import cv2
import numpy as np
import json
from pathlib import Path

BASE_DIR = Path("G:/My Drive/helmet-number-plate-detection")
ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")
IMAGE_PATH = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images/6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")

with open(BASE_DIR / "scratch" / "final_all_detections_verification.json") as f:
    data = json.load(f)

img = cv2.imread(str(IMAGE_PATH))
h, w = img.shape[:2]

CLASS_COLORS = {
    "helmet": (153, 211, 52),       # Emerald
    "no_helmet": (113, 113, 248),    # Red
    "number_plate": (248, 189, 56),  # Cyan
    "pillion": (36, 191, 251),       # Amber
    "rider": (247, 85, 168),         # Purple
}

occupied_tags = []

for idx, d in enumerate(data["detections"]):
    cname = d["class_name"]
    conf = d["confidence"]
    x1, y1, x2, y2 = map(int, d["bbox"])
    color = CLASS_COLORS.get(cname, (200, 200, 200))

    # Box
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

    label_text = f"#{idx+1} {cname} {conf*100:.2f}%"
    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)

    tag_w = tw + 8
    tag_h = th + 8
    tag_x = min(x1, max(0, w - tag_w))
    tag_y = y1 - tag_h

    if tag_y < 0:
        tag_y = y1 + 2

    # Collision avoidance
    attempts = 0
    while attempts < 4:
        collision = any(
            tag_x < ox + ow and tag_x + tag_w > ox and tag_y < oy + oh and tag_y + tag_h > oy
            for (ox, oy, ow, oh) in occupied_tags
        )
        if not collision:
            break
        attempts += 1
        if attempts == 1:
            tag_y = y1 + tag_h + 2
        elif attempts == 2:
            tag_y = max(0, y2 - tag_h - 2)
        elif attempts == 3:
            tag_x = min(max(0, x2 - tag_w), max(0, w - tag_w))

    occupied_tags.append((tag_x, tag_y, tag_w, tag_h))

    cv2.rectangle(img, (tag_x, tag_y), (tag_x + tag_w, tag_y + tag_h), color, -1)
    cv2.putText(img, label_text, (tag_x + 4, tag_y + th + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

cv2.imwrite(str(ARTIFACTS_DIR / "all_10_detections_visual.jpg"), img)
print("Saved all_10_detections_visual.jpg successfully.")
