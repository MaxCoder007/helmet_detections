import cv2
import json
from pathlib import Path

img_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images")
lbl_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\labels")

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

for idx, (label, fname) in enumerate(test_files):
    fpath = img_dir / fname
    lpath = lbl_dir / (Path(fname).stem + ".txt")
    img = cv2.imread(str(fpath))
    h, w = img.shape[:2]
    
    print(f"\n=======================================================")
    print(f"{label}: {fname} ({w}x{h})")
    
    # Ground truth
    gt_heads = []
    if lpath.exists():
        with open(lpath) as lf:
            for line in lf:
                p = line.split()
                if len(p) >= 5:
                    cls_id = int(p[0])
                    xc, yc, bw, bh = map(float, p[1:5])
                    names = {0: "helmet", 1: "no_helmet", 2: "number_plate", 3: "pillion", 4: "rider"}
                    gt_heads.append({
                        "class": names.get(cls_id, str(cls_id)),
                        "bbox": [round((xc - bw/2)*w, 1), round((yc - bh/2)*h, 1), round((xc + bw/2)*w, 1), round((yc + bh/2)*h, 1)]
                    })
    print(f"Ground Truth Annotations ({len(gt_heads)}):")
    for gh in gt_heads:
        print(f"  GT: {gh['class']:12s} bbox={gh['bbox']}")
        
    # Final detections from API
    res = api_results[idx]
    dets = res["detections"]
    headwear = [d for d in dets if d["class_name"] in ("helmet", "no_helmet")]
    print(f"\nFinal Headwear Detections from API ({len(headwear)}):")
    for hd in headwear:
        cx = round((hd["bbox"][0] + hd["bbox"][2]) / 2.0, 1)
        cy = round((hd["bbox"][1] + hd["bbox"][3]) / 2.0, 1)
        bw = round(hd["bbox"][2] - hd["bbox"][0], 1)
        bh = round(hd["bbox"][3] - hd["bbox"][1], 1)
        print(f"  {hd['id']}: {hd['class_name']:10s} {hd['confidence']*100:5.2f}% bbox={hd['bbox']} center=({cx}, {cy}) size=({bw}x{bh})")
