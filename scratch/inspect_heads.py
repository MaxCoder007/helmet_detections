import cv2
import numpy as np
from pathlib import Path

ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")
img = cv2.imread(str(ARTIFACTS_DIR / "original_image.jpg"))

# Let's crop the top half containing both people (y from 0 to 300, x from 200 to 500)
heads_region = img[0:300, 200:500]
cv2.imwrite(str(ARTIFACTS_DIR / "heads_scene_overview.jpg"), heads_region)

# Let's inspect Crop 1 and Crop 4
c1 = cv2.imread(str(ARTIFACTS_DIR / "crop_det_1_no_helmet.jpg"))
c4 = cv2.imread(str(ARTIFACTS_DIR / "crop_det_4_no_helmet.jpg"))

print(f"Crop 1 size: {c1.shape}")
print(f"Crop 4 size: {c4.shape}")
