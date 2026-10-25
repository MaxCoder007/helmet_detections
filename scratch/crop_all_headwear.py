import cv2
import json
from pathlib import Path

img_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images")
lbl_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\labels")
art_dir = Path(r"C:\Users\heman\.gemini\antigravity\brain\228f5cd0-3cd9-42dc-ae34-d9f945ae3429")

test_files = [
    ("Scenario 1: Single unhelmeted rider", "train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg"),
    ("Scenario 2: Single helmeted rider", "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg"),
    ("Scenario 3: Multiple riders in same image", "6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg"),
    ("Scenario 4: Two riders close together", "BikesHelmets248_png.rf.7a098f0ed08009df88b31909fbe8b621.jpg"),
    ("Scenario 5: Crowded traffic scene", "IMG_3142_JPG.rf.dc1259582bba1d89dc472e767a198ab8.jpg"),
    ("Scenario 6: Multiple visible number plates", "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg"),
]

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json") as f:
    api_results = json.load(f)

detailed_audit_records = []

for idx, (label, fname) in enumerate(test_files):
    fpath = img_dir / fname
    img = cv2.imread(str(fpath))
    h, w = img.shape[:2]
    res = api_results[idx]
    dets = res["detections"]
    headwear = [d for d in dets if d["class_name"] in ("helmet", "no_helmet")]
    
    # Save crops of each headwear detection
    scen_crops_dir = art_dir / f"crops_scen_{idx+1}"
    scen_crops_dir.mkdir(parents=True, exist_ok=True)
    
    for hd in headwear:
        b = [int(round(x)) for x in hd["bbox"]]
        x1, y1 = max(0, b[0]), max(0, b[1])
        x2, y2 = min(w, b[2]), min(h, b[3])
        if x2 > x1 and y2 > y1:
            crop = img[y1:y2, x1:x2]
            crop_path = scen_crops_dir / f"{hd['id']}_{hd['class_name']}_{int(hd['confidence']*100)}.jpg"
            cv2.imwrite(str(crop_path), crop)

print("Crops generated for all 6 scenarios.")
