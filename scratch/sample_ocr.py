import easyocr
import cv2
from pathlib import Path

reader = easyocr.Reader(['en'], gpu=False, verbose=False)
crop_dir = Path("scratch/inspected_plates")
crops = sorted(list(crop_dir.glob("*.jpg")))[:25]

for c in crops:
    img = cv2.imread(str(c))
    if img is None:
        continue
    h, w = img.shape[:2]
    res = reader.readtext(img, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -")
    print(f"\nCrop: {c.name} ({w}x{h})")
    for box, text, conf in res:
        print(f"  raw: '{text}' (conf={conf:.3f}) box={box}")
