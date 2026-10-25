import cv2
import numpy as np
from pathlib import Path

ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")
img = cv2.imread(str(ARTIFACTS_DIR / "original_image.jpg"))

# Let's inspect the upper part of the image where the two heads are:
# Person 1: [259.6, 68.8, 327.3, 199.8]
# Person 2: [371.3, 49.8, 430.7, 162.3]
# Let's crop both together:
two_heads = img[40:210, 240:450]
cv2.imwrite(str(ARTIFACTS_DIR / "two_heads_context.jpg"), two_heads)

# Let's inspect the vehicle plate area:
# Plate 1: [185.6, 411.4, 288.5, 450.3]
plate_area = img[380:480, 160:320]
cv2.imwrite(str(ARTIFACTS_DIR / "plate_context.jpg"), plate_area)

# Let's inspect bottom area:
# Detection 3: [187.1, 596.6, 467.6, 639.2]
bottom_area = img[580:640, 150:500]
cv2.imwrite(str(ARTIFACTS_DIR / "bottom_watermark_context.jpg"), bottom_area)

print("Saved contextual crops:")
print("- two_heads_context.jpg (y: 40-210, x: 240-450)")
print("- plate_context.jpg (y: 380-480, x: 160-320)")
print("- bottom_watermark_context.jpg (y: 580-640, x: 150-500)")
