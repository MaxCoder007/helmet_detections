import cv2
import numpy as np
import easyocr
from pathlib import Path

ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")

reader = easyocr.Reader(['en'], gpu=False)

def analyze_crop(filename, label):
    img = cv2.imread(str(ARTIFACTS_DIR / filename))
    h, w, c = img.shape
    mean_bgr = img.mean(axis=(0,1))
    std_bgr = img.std(axis=(0,1))
    ocr_res = reader.readtext(img)
    print(f"=== {label} ({filename}) ===")
    print(f"Dimensions: {w}x{h} px")
    print(f"Mean BGR: {mean_bgr.round(1)}, Std BGR: {std_bgr.round(1)}")
    print(f"OCR Detections: {ocr_res}")
    return ocr_res

ocr_det2 = analyze_crop("crop_det_2_number_plate.jpg", "Detection 2 (number_plate)")
ocr_det3 = analyze_crop("crop_det_3_number_plate.jpg", "Detection 3 (number_plate)")
analyze_crop("crop_det_1_no_helmet.jpg", "Detection 1 (no_helmet)")
analyze_crop("crop_det_4_no_helmet.jpg", "Detection 4 (no_helmet)")
