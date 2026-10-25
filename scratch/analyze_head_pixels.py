import cv2
import numpy as np

c1 = cv2.imread("C:/Users/heman/.gemini/antigravity/brain/228f5cd0-3cd9-42dc-ae34-d9f945ae3429/crop_det_1_no_helmet.jpg")
c4 = cv2.imread("C:/Users/heman/.gemini/antigravity/brain/228f5cd0-3cd9-42dc-ae34-d9f945ae3429/crop_det_4_no_helmet.jpg")
c2 = cv2.imread("C:/Users/heman/.gemini/antigravity/brain/228f5cd0-3cd9-42dc-ae34-d9f945ae3429/crop_det_2_number_plate.jpg")
c3 = cv2.imread("C:/Users/heman/.gemini/antigravity/brain/228f5cd0-3cd9-42dc-ae34-d9f945ae3429/crop_det_3_number_plate.jpg")

print("=== CROP 1 (Main Rider Head) ===")
# Upper half of head (hair/headwear) vs lower half (face)
h1, w1 = c1.shape[:2]
upper1 = c1[:h1//2, :]
lower1 = c1[h1//2:, :]
print("Upper mean RGB:", cv2.cvtColor(upper1, cv2.COLOR_BGR2RGB).mean(axis=(0,1)).astype(int))
print("Lower mean RGB:", cv2.cvtColor(lower1, cv2.COLOR_BGR2RGB).mean(axis=(0,1)).astype(int))

print("\n=== CROP 4 (Second Person Head) ===")
h4, w4 = c4.shape[:2]
upper4 = c4[:h4//2, :]
lower4 = c4[h4//2:, :]
print("Upper mean RGB:", cv2.cvtColor(upper4, cv2.COLOR_BGR2RGB).mean(axis=(0,1)).astype(int))
print("Lower mean RGB:", cv2.cvtColor(lower4, cv2.COLOR_BGR2RGB).mean(axis=(0,1)).astype(int))
