import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageOps

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_PATH = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images/6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg")

# 1. Load image and ensure EXIF orientation
pil_img = Image.open(IMAGE_PATH)
pil_img = ImageOps.exif_transpose(pil_img)
img_rgb = np.array(pil_img.convert("RGB"))
img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
h, w = img_bgr.shape[:2]
print(f"Loaded image {IMAGE_PATH.name}: width={w}, height={h}")

# Save clean original image copy to artifacts
cv2.imwrite(str(ARTIFACTS_DIR / "original_image.jpg"), img_bgr)

# Current 4 detections
detections = [
    {
        "id": 1,
        "class": "no_helmet",
        "conf": 0.9251,
        "bbox": [259.6, 68.8, 327.3, 199.8],
        "color_bgr": (0, 0, 255),    # Red
        "color_name": "Red",
        "label": "1. no_helmet (92.5%)",
    },
    {
        "id": 2,
        "class": "number_plate",
        "conf": 0.8304,
        "bbox": [185.6, 411.4, 288.5, 450.3],
        "color_bgr": (255, 200, 0),  # Cyan / Bright Blue
        "color_name": "Cyan",
        "label": "2. number_plate (83.0%)",
    },
    {
        "id": 3,
        "class": "number_plate",
        "conf": 0.6224,
        "bbox": [187.1, 596.6, 467.6, 639.2],
        "color_bgr": (0, 165, 255),  # Orange
        "color_name": "Orange",
        "label": "3. number_plate (62.2%)",
    },
    {
        "id": 4,
        "class": "no_helmet",
        "conf": 0.2642,
        "bbox": [371.3, 49.8, 430.7, 162.3],
        "color_bgr": (255, 0, 255),  # Magenta
        "color_name": "Magenta",
        "label": "4. no_helmet (26.4%)",
    },
]

# Draw all bounding boxes on full image
annotated_img = img_bgr.copy()
for d in detections:
    x1, y1, x2, y2 = map(int, d["bbox"])
    color = d["color_bgr"]
    cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 3)

    label_text = d["label"]
    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
    label_y = max(y1 - 8, th + 4)
    cv2.rectangle(annotated_img, (x1, label_y - th - 4), (x1 + tw + 6, label_y + 4), color, -1)
    cv2.putText(annotated_img, label_text, (x1 + 3, label_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)

cv2.imwrite(str(ARTIFACTS_DIR / "annotated_4_detections.jpg"), annotated_img)
print(f"Saved annotated image to {ARTIFACTS_DIR / 'annotated_4_detections.jpg'}")

# Generate individual crops for each detection
for d in detections:
    x1, y1, x2, y2 = map(int, d["bbox"])
    # Clamp to image boundaries
    pad = 5
    cx1 = max(0, x1 - pad)
    cy1 = max(0, y1 - pad)
    cx2 = min(w, x2 + pad)
    cy2 = min(h, y2 + pad)

    crop = img_bgr[cy1:cy2, cx1:cx2]
    crop_filename = f"crop_det_{d['id']}_{d['class']}.jpg"
    cv2.imwrite(str(ARTIFACTS_DIR / crop_filename), crop)
    print(f"Detection {d['id']} crop saved to {crop_filename} (size: {cx2-cx1}x{cy2-cy1} px)")

# Also create high-res zoomed versions (upscaled with nearest/bicubic for visual clarity)
for d in detections:
    x1, y1, x2, y2 = map(int, d["bbox"])
    pad = 8
    cx1 = max(0, x1 - pad)
    cy1 = max(0, y1 - pad)
    cx2 = min(w, x2 + pad)
    cy2 = min(h, y2 + pad)

    crop = img_bgr[cy1:cy2, cx1:cx2]
    # Resize up so tiny crops (e.g. 100x40) are large and easily viewable in markdown
    ch, cw = crop.shape[:2]
    scale = max(1, 300 // max(ch, cw, 1))
    if scale > 1:
        crop_zoom = cv2.resize(crop, (cw * scale, ch * scale), interpolation=cv2.INTER_CUBIC)
    else:
        crop_zoom = crop
    crop_zoom_filename = f"crop_zoom_det_{d['id']}_{d['class']}.jpg"
    cv2.imwrite(str(ARTIFACTS_DIR / crop_zoom_filename), crop_zoom)
