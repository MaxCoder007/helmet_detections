import urllib.request
import json
from pathlib import Path

img_dir = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images")

test_scenarios = [
    ("Scenario 1: Single unhelmeted rider", "train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg"),
    ("Scenario 2: Single helmeted rider", "IMG_0533_JPG.rf.71c0ee72cc517a949056e85645299a3a.jpg"),
    ("Scenario 3: Multiple riders in same image", "6_jpg.rf.c41d9d7001d188962cdff59a75b8a373.jpg"),
    ("Scenario 4: Two riders close together", "BikesHelmets248_png.rf.7a098f0ed08009df88b31909fbe8b621.jpg"),
    ("Scenario 5: Crowded traffic scene", "IMG_3142_JPG.rf.dc1259582bba1d89dc472e767a198ab8.jpg"),
    ("Scenario 6: Multiple visible number plates", "new3_jpg.rf.98fb10ef763d0f0432961aa272f6f57e.jpg"),
]

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

print(f"{'Scenario':<38} | {'Conf':<5} | {'Total':<6} | {'Helmets':<8} | {'NoHelmet':<9} | {'Riders':<7} | {'Plates':<7}")
print("-" * 90)

for label, fname in test_scenarios:
    fpath = img_dir / fname
    with open(fpath, "rb") as f:
        file_bytes = f.read()
    data = []
    data.append(f"--{boundary}".encode())
    data.append(f'Content-Disposition: form-data; name="file"; filename="{fname}"'.encode())
    data.append(b"Content-Type: image/jpeg\r\n")
    data.append(file_bytes)
    data.append(f"--{boundary}--\r\n".encode())
    body = b"\r\n".join(data)

    for c in [0.05, 0.25]:
        req = urllib.request.Request(
            f"http://127.0.0.1:8000/predict?conf={c}&iou=0.45&imgsz=1280&max_det=300",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode())
            dets = res["detections"]
            hw = [d for d in dets if d["class_name"] in ("helmet", "no_helmet")]
            helmets = sum(1 for d in hw if d["class_name"] == "helmet")
            no_helmets = sum(1 for d in hw if d["class_name"] == "no_helmet")
            riders = sum(1 for d in dets if d["class_name"] in ("rider", "pillion"))
            plates = sum(1 for d in dets if d["class_name"] == "number_plate")
            print(f"{label:<38} | {c*100:3.0f}% | {len(dets):<6} | {helmets:<8} | {no_helmets:<9} | {riders:<7} | {plates:<7}")
