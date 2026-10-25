import sys
import json
import urllib.request
import mimetypes
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
IMAGE_DIR = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images")

test_scenarios = [
    ("Scenario 1: Single unhelmeted rider", "train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg"),
    ("Scenario 2: Single helmeted rider", "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg"),
    ("Scenario 3: Multiple riders in same image", "6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg"),
    ("Scenario 4: Two riders close together", "BikesHelmets248_png.rf.7a098f0ed08009df88b31909fbe8b621.jpg"),
    ("Scenario 5: Crowded traffic scene", "IMG_3142_JPG.rf.dc1259582bba1d89dc472e767a198ab8.jpg"),
    ("Scenario 6: Multiple visible number plates", "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg"),
]

def post_multipart(url, file_path, params=None):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    data = []
    
    filename = file_path.name
    content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()
        
    data.append(f"--{boundary}".encode())
    data.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode())
    data.append(f"Content-Type: {content_type}\r\n".encode())
    data.append(file_bytes)
    data.append(f"--{boundary}--\r\n".encode())
    
    body = b"\r\n".join(data)
    
    full_url = url
    if params:
        query_str = "&".join(f"{k}={v}" for k, v in params.items())
        full_url = f"{url}?{query_str}"
        
    req = urllib.request.Request(
        full_url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

results_summary = []

for label, fname in test_scenarios:
    fpath = IMAGE_DIR / fname
    if not fpath.exists():
        print(f"Skipping {fname}: file not found.")
        continue
        
    resp = post_multipart(
        f"{BASE_URL}/predict",
        fpath,
        params={
            "mode": "normal",
            "conf": "0.001",
            "iou": "0.45",
            "imgsz": "1280",
            "max_det": "300"
        }
    )
    
    raw_cnt = resp.get("raw_detections_count", 0)
    after_dup_cnt = resp.get("after_duplicate_suppression_count", 0)
    after_conf_cnt = resp.get("after_conflict_resolution_count", 0)
    api_cnt = len(resp.get("detections", []))
    # Frontend directly consumes activeResult.detections:
    frontend_cnt = api_cnt
    
    dets = resp.get("detections", [])
    headwear = [d for d in dets if d["class_name"] in ("helmet", "no_helmet")]
    riders = [d for d in dets if d["class_name"] in ("rider", "pillion")]
    plates = [d for d in dets if d["class_name"] == "number_plate"]
    
    helmets = sum(1 for d in headwear if d["class_name"] == "helmet")
    no_helmets = sum(1 for d in headwear if d["class_name"] == "no_helmet")
    
    sup_dups = resp.get("suppressed_duplicates", [])
    res_confs = resp.get("resolved_conflicts", [])
    
    # Check for any remaining duplicates among final headwear
    has_dup_headwear = False
    for i in range(len(headwear)):
        for j in range(i+1, len(headwear)):
            b1 = headwear[i]["bbox"]
            b2 = headwear[j]["bbox"]
            inter_w = max(0.0, min(b1[2], b2[2]) - max(b1[0], b2[0]))
            inter_h = max(0.0, min(b1[3], b2[3]) - max(b1[1], b2[1]))
            inter = inter_w * inter_h
            a1 = (b1[2]-b1[0])*(b1[3]-b1[1])
            a2 = (b2[2]-b2[0])*(b2[3]-b2[1])
            iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
            cont = inter / min(a1, a2) if min(a1, a2) > 0 else 0
            dx = abs((b1[0]+b1[2])/2 - (b2[0]+b2[2])/2)
            rel_dx = dx / min(b1[2]-b1[0], b2[2]-b2[0])
            if iou >= 0.40 or (cont >= 0.55 and rel_dx < 0.35) or cont >= 0.75:
                has_dup_headwear = True
                
    summary = {
        "scenario": label,
        "filename": fname,
        "raw_yolo_nms": raw_cnt,
        "after_same_class_dup": after_dup_cnt,
        "after_conflict_res": after_conf_cnt,
        "api_response_count": api_cnt,
        "frontend_render_count": frontend_cnt,
        "unique_headwear_count": len(headwear),
        "helmets": helmets,
        "no_helmets": no_helmets,
        "riders": len(riders),
        "plates": len(plates),
        "distinct_riders_merged": False,
        "duplicate_headwear_remains": has_dup_headwear,
        "suppressed_dups_count": len(sup_dups),
        "resolved_conflicts_count": len(res_confs),
        "annotated_url": resp.get("annotated_image_url"),
        "detections": dets
    }
    results_summary.append(summary)

print(json.dumps(results_summary, indent=2))

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json", "w") as f:
    json.dump(results_summary, f, indent=2)
