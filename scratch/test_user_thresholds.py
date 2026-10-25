import urllib.request
import mimetypes
import json
from pathlib import Path

fpath = Path(r"G:\My Drive\computervision\Helmet-NumberPlate-Merged\test\images\train-no-helmet-374-_jpg.rf.e4e768d53dbbb008832f00979e481281.jpg")
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
data = []
with open(fpath, "rb") as f:
    file_bytes = f.read()

data.append(f"--{boundary}".encode())
data.append(b'Content-Disposition: form-data; name="file"; filename="sample.jpg"')
data.append(b"Content-Type: image/jpeg\r\n")
data.append(file_bytes)
data.append(f"--{boundary}--\r\n".encode())
body = b"\r\n".join(data)

for c_val in [0.05, 0.10, 0.25]:
    req = urllib.request.Request(
        f"http://127.0.0.1:8000/predict?conf={c_val}&iou=0.45&imgsz=1280&max_det=300",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"\n=== Results for train-no-helmet-374 at conf={c_val} ({c_val*100:.0f}%) ===")
        print(f"Total Detections: {len(res['detections'])}")
        for d in res["detections"]:
            print(f"  {d['id']}: {d['class_name']:12s} {d['confidence']*100:5.2f}% bbox={d['bbox']}")
