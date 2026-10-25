import cv2
import numpy as np
from pathlib import Path

ARTIFACTS_DIR = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")

# Load annotated image and crops
ann = cv2.imread(str(ARTIFACTS_DIR / "annotated_4_detections.jpg"))
c1 = cv2.imread(str(ARTIFACTS_DIR / "crop_zoom_det_1_no_helmet.jpg"))
c2 = cv2.imread(str(ARTIFACTS_DIR / "crop_zoom_det_2_number_plate.jpg"))
c3 = cv2.imread(str(ARTIFACTS_DIR / "crop_zoom_det_3_number_plate.jpg"))
c4 = cv2.imread(str(ARTIFACTS_DIR / "crop_zoom_det_4_no_helmet.jpg"))

# Create individual labeled visual cards for each crop
def create_card(crop, title, subtitle, border_color):
    h, w = crop.shape[:2]
    # Add title header
    header_h = 50
    card = np.zeros((h + header_h + 10, max(w, 320), 3), dtype=np.uint8)
    card[:] = (26, 22, 17) # Dark background matching UI
    
    # Border
    cv2.rectangle(card, (0, 0), (card.shape[1]-1, card.shape[0]-1), border_color, 2)
    
    # Title
    cv2.putText(card, title, (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    cv2.putText(card, subtitle, (12, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.45, border_color, 1)
    
    # Paste crop centered
    x_off = (card.shape[1] - w) // 2
    card[header_h:header_h + h, x_off:x_off + w] = crop
    return card

card1 = create_card(c1, "Det 1: no_helmet (92.5%)", "Foreground Rider Head", (0, 0, 255))
card2 = create_card(c2, "Det 2: number_plate (83.0%)", "Genuine Motorcycle Plate (Matches GT)", (255, 200, 0))
card3 = create_card(c3, "Det 3: number_plate (62.2%)", "Shutterstock Watermark Banner", (0, 165, 255))
card4 = create_card(c4, "Det 4: no_helmet (26.4%)", "Secondary Person Head (Unhelmeted)", (255, 0, 255))

cv2.imwrite(str(ARTIFACTS_DIR / "card_det_1.jpg"), card1)
cv2.imwrite(str(ARTIFACTS_DIR / "card_det_2.jpg"), card2)
cv2.imwrite(str(ARTIFACTS_DIR / "card_det_3.jpg"), card3)
cv2.imwrite(str(ARTIFACTS_DIR / "card_det_4.jpg"), card4)

print("Generated inspection visual cards successfully.")
