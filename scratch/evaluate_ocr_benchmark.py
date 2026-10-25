import json
import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

from backend.ocr import extract_number_plate_ocr, normalize_ocr_text

def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute standard Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def calculate_cer(reference: str, hypothesis: str) -> float:
    """Character Error Rate = edit_distance / len(reference)."""
    ref = normalize_ocr_text(reference)
    hyp = normalize_ocr_text(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    dist = levenshtein_distance(ref, hyp)
    return round(min(1.0, dist / len(ref)), 4)

def run_benchmark(manifest_path="scratch/ocr_evaluation_manifest.json"):
    manifest = json.loads(Path(manifest_path).read_text())
    dataset_dirs = [
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/images"),
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/valid/images"),
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/train/images"),
    ]
    label_dirs = [
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/test/labels"),
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/valid/labels"),
        Path("G:/My Drive/computervision/Helmet-NumberPlate-Merged/train/labels"),
    ]

    def find_file(fname, search_dirs):
        for d in search_dirs:
            p = d / fname
            if p.exists():
                return p
        return None

    results = []
    latencies = []
    readable_total = 0
    exact_matches = 0
    total_cer = 0.0
    covered_plates = 0

    for item in manifest:
        img_p = find_file(item["image_file"], dataset_dirs)
        if not img_p:
            continue

        lbl_p = find_file(img_p.stem + ".txt", label_dirs)
        img = cv2.imread(str(img_p))
        if img is None:
            continue
        h, w = img.shape[:2]

        gt = item["ground_truth"]
        is_readable = gt is not None

        # Find plate bbox from label or estimate center
        plate_bboxes = []
        if lbl_p and lbl_p.exists():
            with open(lbl_p) as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5 and parts[0] == "2":
                        cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                        x1 = max(0, int((cx - bw/2) * w))
                        y1 = max(0, int((cy - bh/2) * h))
                        x2 = min(w, int((cx + bw/2) * w))
                        y2 = min(h, int((cy + bh/2) * h))
                        plate_bboxes.append([x1, y1, x2, y2])

        if not plate_bboxes:
            # If negative sample (no plate)
            if not is_readable:
                results.append({
                    "id": item["id"],
                    "ground_truth": None,
                    "ocr_output": None,
                    "exact_match": True,
                    "cer": 0.0,
                    "category": item["category"],
                    "status": "correct_negative"
                })
                continue
            else:
                continue

        # Evaluate first plate box
        bbox = plate_bboxes[0]

        t0 = time.perf_counter()
        ocr_res = extract_number_plate_ocr(img, bbox)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)

        pred_text = ocr_res.get("text")
        
        if is_readable:
            readable_total += 1
            if pred_text:
                covered_plates += 1
                cer = calculate_cer(gt, pred_text)
                is_exact = (normalize_ocr_text(pred_text) == normalize_ocr_text(gt))
            else:
                cer = 1.0
                is_exact = False

            if is_exact:
                exact_matches += 1
            total_cer += cer

            results.append({
                "id": item["id"],
                "file": item["image_file"],
                "category": item["category"],
                "ground_truth": gt,
                "ocr_output": pred_text,
                "ocr_confidence": ocr_res.get("confidence"),
                "format_valid": ocr_res.get("format_valid"),
                "exact_match": is_exact,
                "cer": cer,
                "latency_ms": round(elapsed_ms, 2)
            })
        else:
            # Unreadable plate: correct if status is unreadable or text is None
            correct_unreadable = (pred_text is None)
            results.append({
                "id": item["id"],
                "file": item["image_file"],
                "category": item["category"],
                "ground_truth": None,
                "ocr_output": pred_text,
                "exact_match": correct_unreadable,
                "cer": 0.0 if correct_unreadable else 1.0,
                "latency_ms": round(elapsed_ms, 2)
            })

    exact_match_acc = (exact_matches / readable_total * 100) if readable_total > 0 else 0
    avg_cer = (total_cer / readable_total) if readable_total > 0 else 0
    coverage = (covered_plates / readable_total * 100) if readable_total > 0 else 0
    avg_latency = float(np.mean(latencies)) if latencies else 0

    summary = {
        "readable_plates": readable_total,
        "exact_matches": exact_matches,
        "exact_match_accuracy_pct": round(exact_match_acc, 2),
        "mean_cer": round(avg_cer, 4),
        "ocr_coverage_pct": round(coverage, 2),
        "average_latency_ms": round(avg_latency, 2),
        "details": results
    }
    return summary

if __name__ == "__main__":
    baseline = run_benchmark()
    with open("scratch/baseline_ocr_benchmark.json", "w") as f:
        json.dump(baseline, f, indent=2)

    print("\n================== BASELINE OCR BENCHMARK ==================")
    print(f"Readable Plates Tested:   {baseline['readable_plates']}")
    print(f"Exact Matches:           {baseline['exact_matches']} / {baseline['readable_plates']}")
    print(f"Exact-Match Accuracy:    {baseline['exact_match_accuracy_pct']}%")
    print(f"Mean Character Error (CER): {baseline['mean_cer']}")
    print(f"OCR Coverage:            {baseline['ocr_coverage_pct']}%")
    print(f"Average Latency:         {baseline['average_latency_ms']} ms")
    print("-----------------------------------------------------------")
    for r in baseline["details"]:
        status_sym = "[MATCH]" if r["exact_match"] else "[DIFF]"
        print(f"{status_sym} {r['id']:<26} GT: {str(r.get('ground_truth')):<14} -> Pred: {str(r.get('ocr_output')):<14} CER={r['cer']}")
