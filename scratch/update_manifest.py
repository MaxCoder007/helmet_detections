import json
from pathlib import Path

manifest_path = Path("scratch/ocr_evaluation_manifest.json")
data = json.loads(manifest_path.read_text())

for item in data:
    if item["id"] == "plate_13_small_distant":
        item["image_file"] = "156_jpg.rf.79b94fdecd3630090dd6ef16f02221e6.jpg"
        item["ground_truth"] = "KA547916"
        item["description"] = "Small Karnataka plate with format KA 54 7916"

manifest_path.write_text(json.dumps(data, indent=2))
print("Updated manifest.")
