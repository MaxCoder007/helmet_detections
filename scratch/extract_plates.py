import cv2
from pathlib import Path

root = Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged")
out_dir = Path("scratch/inspected_plates")
out_dir.mkdir(parents=True, exist_ok=True)

plate_info = []

for split in ["test", "valid"]:
    lbl_dir = root / split / "labels"
    img_dir = root / split / "images"
    for lbl in sorted(lbl_dir.glob("*.txt")):
        with open(lbl) as f:
            lines = [l.strip() for l in f if l.strip().startswith("2 ")]
        if not lines:
            continue
        
        img_path = img_dir / (lbl.stem + ".jpg")
        if not img_path.exists():
            continue
            
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]
        
        for idx, line in enumerate(lines):
            parts = line.split()
            cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
            x1 = max(0, int((cx - bw/2) * w))
            y1 = max(0, int((cy - bh/2) * h))
            x2 = min(w, int((cx + bw/2) * w))
            y2 = min(h, int((cy + bh/2) * h))
            
            crop = img[y1:y2, x1:x2]
            crop_name = f"{lbl.stem}_p{idx}.jpg"
            if crop.size > 0:
                cv2.imwrite(str(out_dir / crop_name), crop)
                plate_info.append({
                    "split": split,
                    "img_name": img_path.name,
                    "crop_name": crop_name,
                    "bbox": [x1, y1, x2, y2],
                    "crop_w": x2 - x1,
                    "crop_h": y2 - y1,
                })

print(f"Extracted {len(plate_info)} plate crops to {out_dir}")
for p in plate_info[:20]:
    print(f"{p['crop_name']}: {p['crop_w']}x{p['crop_h']} in {p['img_name']}")
