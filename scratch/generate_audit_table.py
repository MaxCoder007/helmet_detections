import json
from pathlib import Path

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\headwear_audit.json") as f:
    audits = json.load(f)

# Ground truth human inspection of visible heads per scenario:
# Scenario 1: train-no-helmet-374: Exactly 1 visible head (unhelmeted rider)
# Scenario 2: IMG_0533: 3 visible heads (1 helmeted rider on bike, 2 unhelmeted pedestrians on far right sidewalk)
# Scenario 3: 6_jpg: 2 visible heads (unhelmeted rider in front, unhelmeted secondary rider/pillion behind)
# Scenario 4: BikesHelmets248: 2 visible heads (unhelmeted rider and pillion right behind each other)
# Scenario 5: IMG_3142: 3 visible heads (unhelmeted rider on left bike, helmeted pillion on right bike, unhelmeted rider on right bike)
# Scenario 6: new3_jpg: 3 visible heads (3 unhelmeted riders in traffic)

audit_mappings = {
    "Scenario 1: Single unhelmeted rider": {
        "visible_heads": 1,
        "head_descriptions": ["Person 1: Single unhelmeted rider"],
        "detections": {
            "det_1": ("Person 1 Head", "Distinct person / Authoritative headwear", True),
            "det_2": ("Cannot be assigned to a head (Top-right sky corner)", "Uncertain noise (<3% conf)", False),
            "det_3": ("Cannot be assigned to a head (Motorcycle rear wheel/tire)", "Uncertain noise (<2% conf)", False),
            "det_5": ("Cannot be assigned to a head (Road boundary)", "Uncertain noise (<1% conf)", False),
            "det_6": ("Cannot be assigned to a head (Asphalt road)", "Uncertain noise (<1% conf)", False),
            "det_8": ("Cannot be assigned to a head (Asphalt corner)", "Uncertain noise (<1% conf)", False),
            "det_13": ("Cannot be assigned to a head (Motorcycle exhaust/engine)", "Uncertain noise (<1% conf)", False),
            "det_15": ("Cannot be assigned to a head (Road surface)", "Uncertain noise (<1% conf)", False),
            "det_16": ("Cannot be assigned to a head (Top skyline)", "Uncertain noise (<1% conf)", False),
        }
    },
    "Scenario 2: Single helmeted rider": {
        "visible_heads": 3,
        "head_descriptions": ["Person 1: Helmeted rider", "Person 2: Pedestrian 1 on right sidewalk", "Person 3: Pedestrian 2 on right sidewalk"],
        "detections": {
            "det_1": ("Person 1 Head (Rider)", "Distinct person / Authoritative headwear", True),
            "det_2": ("Person 2 Head (Pedestrian 1 on sidewalk)", "Distinct person / Authoritative headwear", True),
            "det_3": ("Person 3 Head (Pedestrian 2 on sidewalk)", "Distinct person / Authoritative headwear", True),
            "det_8": ("Cannot be assigned to a head (Far left building/pole)", "Uncertain noise (0.12% conf)", False),
        }
    },
    "Scenario 3: Multiple riders in same image": {
        "visible_heads": 2,
        "head_descriptions": ["Person 1: Foreground rider", "Person 2: Secondary rider/pillion"],
        "detections": {
            "det_0": ("Person 1 Head (Foreground rider)", "Distinct person / Authoritative headwear", True),
            "det_3": ("Person 2 Head (Secondary rider)", "Distinct person / Authoritative headwear", True),
            "det_11": ("Cannot be assigned to a head (Right image edge noise)", "Uncertain noise (0.13% conf)", False),
            "det_12": ("Cannot be assigned to a head (Right image edge noise)", "Uncertain noise (0.12% conf)", False),
        }
    },
    "Scenario 4: Two riders close together": {
        "visible_heads": 2,
        "head_descriptions": ["Person 1: Front rider", "Person 2: Pillion behind rider"],
        "detections": {
            "det_0": ("Person 1 & 2 Combined Head Region", "Authoritative cluster prediction (model predicted single box enclosing both heads)", True),
            "det_2": ("Cannot be assigned to a head (Background wall)", "Uncertain noise (0.28% conf)", False),
            "det_3": ("Cannot be assigned to a head (Motorcycle handlebar)", "Uncertain noise (0.17% conf)", False),
        }
    },
    "Scenario 5: Crowded traffic scene": {
        "visible_heads": 3,
        "head_descriptions": ["Person 1: Rider on left motorcycle", "Person 2: Helmeted pillion on right motorcycle", "Person 3: Unhelmeted rider on right motorcycle"],
        "detections": {
            "det_5": ("Person 1 Head (Left rider)", "Distinct person / Authoritative headwear", True),
            "det_4": ("Person 2 Head (Right pillion)", "Distinct person / Authoritative headwear", True),
            "det_3": ("Person 3 Head (Right rider)", "Distinct person / Authoritative headwear", True),
            "det_8": ("Cannot be assigned to a head (Right motorcycle exhaust)", "Uncertain noise (0.18% conf)", False),
        }
    },
    "Scenario 6: Multiple visible number plates": {
        "visible_heads": 3,
        "head_descriptions": ["Person 1: Center-right rider", "Person 2: Center-left rider", "Person 3: Middle rider"],
        "detections": {
            "det_0": ("Person 1 Head (Center-right rider)", "Distinct person / Authoritative headwear", True),
            "det_1": ("Person 2 Head (Center-left rider)", "Distinct person / Authoritative headwear", True),
            "det_2": ("Person 3 Head (Middle rider)", "Distinct person / Authoritative headwear", True),
            "det_5": ("Cannot be assigned to a head (Top foliage/sky)", "Uncertain noise (2.38% conf)", False),
            "det_6": ("Cannot be assigned to a head (Motorcycle mirror)", "Uncertain noise (0.60% conf)", False),
            "det_11": ("Cannot be assigned to a head (Motorcycle rear wheel)", "Uncertain noise (0.18% conf)", False),
            "det_12": ("Cannot be assigned to a head (Motorcycle rear tire)", "Uncertain noise (0.15% conf)", False),
        }
    }
}

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\audit_mapped.json", "w") as f:
    json.dump(audit_mappings, f, indent=2)

print("Mapped audit successfully created.")
