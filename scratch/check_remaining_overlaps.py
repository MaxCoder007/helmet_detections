import json

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\headwear_audit.json") as f:
    audits = json.load(f)

for a in audits:
    print(f"=== {a['scenario']} ===")
    heads_with_multi = 0
    heads_with_conflict = 0
    for hw in a['headwear']:
        for o in hw['overlaps']:
            if o['iou'] >= 0.25 or o['containment'] >= 0.50:
                print(f"  Warning: {hw['id']} overlaps with {o['other_id']}: IoU={o['iou']}, Cont={o['containment']}, rel_dx={o['rel_dx']}")
                if hw['class_name'] == o['other_class']:
                    heads_with_multi += 1
                else:
                    heads_with_conflict += 1
    if heads_with_multi == 0 and heads_with_conflict == 0:
        print("  Zero overlapping headwear on any head.")
