import json

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\headwear_audit.json") as f:
    audits = json.load(f)

for a in audits:
    print(f"\n=======================================================")
    print(f"Scenario: {a['scenario']} ({a['filename']}) - Size: {a['image_size']}")
    print(f"Total Headwear Detections: {a['headwear_count']}")
    for hw in a['headwear']:
        ov_str = ""
        if hw['overlaps']:
            ov_str = " | Overlaps: " + ", ".join([f"{o['other_id']} ({o['other_class']} iou={o['iou']} cont={o['containment']})" for o in hw['overlaps']])
        print(f"  [{hw['id']}] {hw['class_name']:10s} {hw['confidence']*100:5.2f}% bbox={hw['bbox']} center={hw['center']}{ov_str}")
