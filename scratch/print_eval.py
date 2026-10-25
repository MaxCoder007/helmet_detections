import json

with open('scratch/eval_5_images.json') as f:
    data = json.load(f)

for item in data:
    print('=' * 70)
    print(f"{item['scenario']} ({item['filename']})")
    print(f"Normal Mode Retained: {item['normal_mode']['retained_detections']} detections. Counts: {item['normal_mode']['counts']}")
    for d in item['normal_mode']['detections']:
        print(f"  -> {d['class']:12} conf={d['confidence']:.4f} bbox={d['bbox']} quality={d['quality_status']}")
    print(f"Compliance Records: {item['normal_mode']['compliance_records']}")
    print(f"Debug Mode: Raw={item['debug_mode']['raw_count']}, DupSupp={item['debug_mode']['suppressed_duplicates_count']}, ConflictSupp={item['debug_mode']['resolved_conflicts_count']}, Quality={item['debug_mode']['quality_summary']}")
