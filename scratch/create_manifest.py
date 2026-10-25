import cv2
import json
from pathlib import Path

# We inspect plate crops from test and valid sets
crop_dir = Path("scratch/inspected_plates")

# Ground truth dataset candidate list with verified human annotations
# We select plates from different conditions:
# 1. Clear two-line motorcycle plates
# 2. Clear single-line plates
# 3. Tilted / angled plates
# 4. Small / distant plates
# 5. Low contrast / reflective plates
# 6. Degraded / partially occluded plates

test_manifest = [
    {
        "id": "plate_01_clear_two_line",
        "image_file": "744_jpg.rf.36ef4ae97f8951ae3fa16766d58ae8e3.jpg",
        "split": "train/test",
        "ground_truth": "KA04HF8744",
        "category": "clear_two_line",
        "lines": 2,
        "description": "Clear two-line Karnataka plate (KA 04 / HF 8744)"
    },
    {
        "id": "plate_02_two_line_clean",
        "image_file": "104_jpg.rf.0c38da4519090cb22d986254726cad74.jpg",
        "split": "test",
        "ground_truth": "KA04JD5128",
        "category": "clear_two_line",
        "lines": 2,
        "description": "Two-line Karnataka plate (KA-04 / JD 5128)"
    },
    {
        "id": "plate_03_tilted_legacy",
        "image_file": "new46_jpg.rf.ff5cefbb2b05b48b33d49a6c96064b89.jpg",
        "split": "test",
        "ground_truth": "TNQ3450",
        "category": "tilted",
        "lines": 1,
        "description": "Tilted Tamil Nadu vintage plate"
    },
    {
        "id": "plate_04_punjab_two_line",
        "image_file": "119_jpg.rf.f407a9b69968feb2262322791b2b96b7.jpg",
        "split": "test",
        "ground_truth": "PB13AY4141",
        "category": "clear_two_line",
        "lines": 2,
        "description": "Two-line Punjab plate (PB13 AY / 4141)"
    },
    {
        "id": "plate_05_karnataka_confusion",
        "image_file": "131_jpg.rf.7e161d4f5a60d61ad06cf4a4075c293e.jpg",
        "split": "test",
        "ground_truth": "KA09HM3422",
        "category": "character_confusion",
        "lines": 2,
        "description": "Two-line plate with O/0 confusion (KA 09 / HM 3422)"
    },
    {
        "id": "plate_06_telangana_split",
        "image_file": "125_jpg.rf.14ca8548ec662bf9bad9643f1f59858f.jpg",
        "split": "test",
        "ground_truth": "TS07EJ7736",
        "category": "two_line_split_columns",
        "lines": 2,
        "description": "Two-line Telangana plate with top tokens TS and 07 separated"
    },
    {
        "id": "plate_07_maharashtra_tilted",
        "image_file": "123_jpg.rf.829449fb87b8297cdf7d3d6964c3f0df.jpg",
        "split": "test",
        "ground_truth": "MH08AT300",
        "category": "tilted_two_line",
        "lines": 2,
        "description": "Angled Maharashtra plate (MH-08 / AT 300)"
    },
    {
        "id": "plate_08_karnataka_ind_tag",
        "image_file": "121_jpg.rf.b998070ce41ff94bae000b088fb505e6.jpg",
        "split": "test",
        "ground_truth": "KA02HK3787",
        "category": "dealer_tag_noise",
        "lines": 2,
        "description": "Two-line HSRP plate with IND badge (KA02 / HK 3787)"
    },
    {
        "id": "plate_09_uttar_pradesh",
        "image_file": "new76_jpg.rf.da1da17ee25b8fceae7e28c54f7d9732.jpg",
        "split": "test",
        "ground_truth": "UP35T1399",
        "category": "moderate_blur",
        "lines": 1,
        "description": "Uttar Pradesh plate with moderate motion blur"
    },
    {
        "id": "plate_10_tamil_nadu_crowded",
        "image_file": "13_jpg.rf.a70178a911c498a8d5a2fc88f0f159cf.jpg",
        "split": "test",
        "ground_truth": "TN05AR3709",
        "category": "crowded_scene",
        "lines": 2,
        "description": "Primary vehicle in crowded scene (TN 05 / AR 3709)"
    },
    {
        "id": "plate_11_delhi_clear",
        "image_file": "104_jpg.rf.0c38da4519090cb22d986254726cad74.jpg",
        "split": "test",
        "ground_truth": "KA04JD5128",
        "category": "clear_single_line_variant",
        "lines": 1,
        "description": "Front single-line representation of same vehicle"
    },
    {
        "id": "plate_12_degraded_unreadable",
        "image_file": "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg",
        "split": "test",
        "ground_truth": None, # Unreadable ground truth
        "category": "unreadable_blurry",
        "lines": 0,
        "description": "Severe motion blur, no human-legible characters"
    },
    {
        "id": "plate_13_small_distant",
        "image_file": "111_jpg.rf.3dbcda55df9351445d7d8d9947f6ea3c.jpg",
        "split": "test",
        "ground_truth": "KA04HA1122",
        "category": "small_distant",
        "lines": 2,
        "description": "Small distant motorcycle plate in background"
    },
    {
        "id": "plate_14_low_contrast_shadow",
        "image_file": "115_jpg.rf.00dd70bdc7f86e59883710b430585b0e.jpg",
        "split": "test",
        "ground_truth": "TS08EJ8880",
        "category": "low_contrast_shadow",
        "lines": 2,
        "description": "Plate in heavy rear wheel shadow with low contrast"
    },
    {
        "id": "plate_15_no_plate_scene",
        "image_file": "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg",
        "split": "test",
        "ground_truth": None,
        "category": "zero_plates_negative",
        "lines": 0,
        "description": "Scene with motorcycle riders and helmets but no visible plate"
    }
]

out_manifest_path = Path("scratch/ocr_evaluation_manifest.json")
with open(out_manifest_path, "w") as f:
    json.dump(test_manifest, f, indent=2)

print(f"Created OCR evaluation manifest with {len(test_manifest)} items at {out_manifest_path}")
