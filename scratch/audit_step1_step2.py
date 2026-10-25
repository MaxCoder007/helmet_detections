import cv2
import json
import numpy as np
from pathlib import Path

img_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images")
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

def compute_box_metrics(b1, b2):
    xA = max(b1[0], b2[0])
    yA = max(b1[1], b2[1])
    xB = min(b1[2], b2[2])
    yB = min(b1[3], b2[3])
    iw = max(0.0, xB - xA)
    ih = max(0.0, yB - yA)
    ia = iw * ih
    a1 = (b1[2]-b1[0])*(b1[3]-b1[1])
    a2 = (b2[2]-b2[0])*(b2[3]-b2[1])
    u = a1 + a2 - ia
    iou = ia / u if u > 0 else 0.0
    cont = ia / min(a1, a2) if min(a1, a2) > 0 else 0.0
    dx = abs((b1[0]+b1[2])/2 - (b2[0]+b2[2])/2)
    dy = abs((b1[1]+b1[3])/2 - (b2[1]+b2[3])/2)
    w_min = min(b1[2]-b1[0], b2[2]-b2[0])
    h_min = min(b1[3]-b1[1], b2[3]-b2[1])
    rel_dx = dx / w_min if w_min > 0 else 0.0
    rel_dy = dy / h_min if h_min > 0 else 0.0
    return round(iou, 3), round(cont, 3), round(rel_dx, 3), round(rel_dy, 3)

audit_data = []

for idx, (label, fname) in enumerate(test_files):
    fpath = img_dir / fname
    img = cv2.imread(str(fpath))
    h, w = img.shape[:2]
    
    res = api_results[idx]
    dets = res["detections"]
    headwear = [d for d in dets if d["class_name"] in ("helmet", "no_helmet")]
    
    # Render overlay with ID and class
    overlay = img.copy()
    colors = {
        "helmet": (52, 211, 153),
        "no_helmet": (113, 113, 248),
        "number_plate": (255, 232, 139),
        "pillion": (252, 171, 240),
        "rider": (250, 165, 96),
    }
    
    for d in dets:
        b = [int(round(x)) for x in d["bbox"]]
        cname = d["class_name"]
        conf = d["confidence"]
        col = colors.get(cname, (200, 200, 200))
        cv2.rectangle(overlay, (b[0], b[1]), (b[2], b[3]), col, 2)
        tag = f"{d['id']} {cname} {conf*100:.1f}%"
        cv2.putText(overlay, tag, (b[0], max(14, b[1]-5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, col, 1)
        
    out_overlay_path = art_dir / f"overlay_{Path(fname).stem}.jpg"
    cv2.imwrite(str(out_overlay_path), overlay)
    
    # Audit each headwear detection
    hw_audit = []
    for i, h_det in enumerate(headwear):
        b1 = h_det["bbox"]
        cx = round((b1[0] + b1[2]) / 2.0, 1)
        cy = round((b1[1] + b1[3]) / 2.0, 1)
        
        # Check overlaps with all other headwear
        overlaps = []
        for j, other in enumerate(headwear):
            if i == j:
                continue
            b2 = other["bbox"]
            iou, cont, rdx, rdy = compute_box_metrics(b1, b2)
            if cont > 0.05 or iou > 0.05:
                overlaps.append({
                    "other_id": other["id"],
                    "other_class": other["class_name"],
                    "other_conf": other["confidence"],
                    "iou": iou,
                    "containment": cont,
                    "rel_dx": rdx,
                    "rel_dy": rdy
                })
                
        hw_audit.append({
            "id": h_det["id"],
            "class_name": h_det["class_name"],
            "confidence": h_det["confidence"],
            "bbox": b1,
            "center": (cx, cy),
            "size": (round(b1[2]-b1[0], 1), round(b1[3]-b1[1], 1)),
            "overlaps": overlaps,
        })
        
    audit_data.append({
        "scenario": label,
        "filename": fname,
        "image_size": (w, h),
        "headwear_count": len(headwear),
        "headwear": hw_audit,
        "overlay_image": str(out_overlay_path)
    })

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\headwear_audit.json", "w") as f:
    json.dump(audit_data, f, indent=2)

print("Saved audit data to scratch/headwear_audit.json")
