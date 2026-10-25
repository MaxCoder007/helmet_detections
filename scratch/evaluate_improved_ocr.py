import json
import time
import sys
from typing import Dict, Any, List, Optional
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
import easyocr

from scratch.evaluate_ocr_benchmark import calculate_cer, levenshtein_distance
from scratch.ocr_enhancement_core import (
    order_tokens_into_reading_sequence,
    generate_registration_hypotheses,
    score_plate_candidate,
    INDIAN_STATE_CODES,
    PATTERN_STANDARD
)

reader = easyocr.Reader(['en'], gpu=False, verbose=False)

def preprocess_variant_a_clahe(crop: np.ndarray) -> np.ndarray:
    """Variant A: Grayscale + CLAHE + bilateral."""
    h, w = crop.shape[:2]
    scale = max(1.5, min(3.5, 95.0 / h)) if h < 80 else (240.0 / h if h > 250 else 1.0)
    resized = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)

def preprocess_variant_b_sharpen(crop: np.ndarray) -> np.ndarray:
    """Variant B: Normalized Grayscale + Unsharp Masking."""
    h, w = crop.shape[:2]
    scale = max(1.5, min(3.5, 95.0 / h)) if h < 80 else (240.0 / h if h > 250 else 1.0)
    resized = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized
    # Normalized stretch
    norm = cv2.normalize(gray, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    # Unsharp mask
    blurred = cv2.GaussianBlur(norm, (0, 0), sigmaX=2.0)
    sharpened = cv2.addWeighted(norm, 1.6, blurred, -0.6, 0)
    return sharpened

def preprocess_variant_c_otsu(crop: np.ndarray) -> np.ndarray:
    """Variant C: Adaptive/Otsu Thresholding."""
    h, w = crop.shape[:2]
    scale = max(1.5, min(3.5, 95.0 / h)) if h < 80 else (240.0 / h if h > 250 else 1.0)
    resized = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh

def process_plate_crop_multi_pass(crop_bgr: np.ndarray, max_passes=2) -> Dict[str, Any]:
    """
    Run multi-pass OCR on plate crop with tuned EasyOCR parameters:
    1. Pass 1: Sharpened Normalized Grayscale (Variant B)
    2. Pass 2: CLAHE + Bilateral Enhanced (Variant A)
    Generates hypotheses, evaluates line structure, and picks the highest-scoring candidate.
    """
    if crop_bgr is None or crop_bgr.size == 0:
        return {"text": None, "confidence": None, "format_valid": None, "status": "unreadable"}

    h, w = crop_bgr.shape[:2]
    if h < 12 or w < 25:
        return {"text": None, "confidence": None, "format_valid": None, "status": "unreadable"}

    variants = [
        ("sharpen", preprocess_variant_b_sharpen(crop_bgr)),
        ("clahe", preprocess_variant_a_clahe(crop_bgr)),
    ]
    if max_passes >= 3:
        variants.append(("otsu", preprocess_variant_c_otsu(crop_bgr)))

    all_scored_candidates = []

    for v_name, v_img in variants[:max_passes]:
        try:
            raw_ocr = reader.readtext(
                v_img,
                allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -",
                text_threshold=0.55,
                low_text=0.30,
                link_threshold=0.35,
                min_size=8,
                width_ths=0.7,
                paragraph=False
            )
        except Exception as e:
            continue

        if not raw_ocr:
            continue

        # 1. Sort into 2D reading order (two-line plate support)
        ordered_tokens = order_tokens_into_reading_sequence(raw_ocr)
        if not ordered_tokens:
            continue

        # Filter very low confidence noise tokens unless they form a valid state code
        filtered_tokens = []
        for t, c, b in ordered_tokens:
            if c >= 0.15 or t in INDIAN_STATE_CODES or (len(t) >= 4 and c >= 0.12):
                filtered_tokens.append((t, c, b))

        if not filtered_tokens:
            filtered_tokens = ordered_tokens

        token_texts = [t[0] for t in filtered_tokens]
        token_confs = [t[1] for t in filtered_tokens]
        raw_joined = "".join(token_texts)
        avg_conf = float(np.mean(token_confs)) if token_confs else 0.0

        # 2. Evaluate candidate hypotheses (position-aware character confusion)
        hypotheses = generate_registration_hypotheses(raw_joined)

        for hyp in hypotheses:
            score, meta = score_plate_candidate(hyp, avg_conf)
            all_scored_candidates.append({
                "candidate": hyp,
                "score": score,
                "avg_conf": avg_conf,
                "meta": meta,
                "variant": v_name,
                "raw_joined": raw_joined,
            })

    if not all_scored_candidates:
        return {
            "text": None,
            "confidence": None,
            "format_valid": None,
            "status": "unreadable",
            "format_type": "no_text_detected",
            "raw_text": "",
        }

    # Sort candidates by combined score descending
    all_scored_candidates.sort(key=lambda c: c["score"], reverse=True)
    best = all_scored_candidates[0]

    return {
        "text": best["candidate"],
        "confidence": round(best["avg_conf"], 4),
        "format_valid": best["meta"]["is_valid"],
        "format_type": best["meta"]["format_type"],
        "status": "success" if best["avg_conf"] >= 0.20 else "unreadable",
        "raw_text": best["raw_joined"],
        "score": round(best["score"], 4),
        "variant": best["variant"],
    }

def evaluate_improved_system():
    manifest = json.loads(Path("scratch/ocr_evaluation_manifest.json").read_text())
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
            if not is_readable:
                results.append({
                    "id": item["id"],
                    "ground_truth": None,
                    "ocr_output": None,
                    "exact_match": True,
                    "cer": 0.0,
                    "category": item["category"]
                })
            continue

        x1, y1, x2, y2 = plate_bboxes[0]
        # Improved adaptive padding: 8% horizontal, 10% vertical to prevent clipping edge glyphs
        pad_x = int((x2 - x1) * 0.08)
        pad_y = int((y2 - y1) * 0.10)
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(w, x2 + pad_x)
        cy2 = min(h, y2 + pad_y)
        crop = img[cy1:cy2, cx1:cx2]

        t0 = time.perf_counter()
        ocr_res = process_plate_crop_multi_pass(crop, max_passes=2)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)

        pred_text = ocr_res.get("text")

        if is_readable:
            readable_total += 1
            if pred_text:
                covered_plates += 1
                cer = calculate_cer(gt, pred_text)
                is_exact = (pred_text == gt)
            else:
                cer = 1.0
                is_exact = False

            if is_exact:
                exact_matches += 1
            total_cer += cer

            results.append({
                "id": item["id"],
                "category": item["category"],
                "ground_truth": gt,
                "ocr_output": pred_text,
                "confidence": ocr_res.get("confidence"),
                "format_valid": ocr_res.get("format_valid"),
                "exact_match": is_exact,
                "cer": cer,
                "latency_ms": round(elapsed_ms, 2),
                "variant": ocr_res.get("variant")
            })
        else:
            correct_unreadable = (pred_text is None)
            results.append({
                "id": item["id"],
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

    return {
        "readable_plates": readable_total,
        "exact_matches": exact_matches,
        "exact_match_accuracy_pct": round(exact_match_acc, 2),
        "mean_cer": round(avg_cer, 4),
        "ocr_coverage_pct": round(coverage, 2),
        "average_latency_ms": round(avg_latency, 2),
        "details": results
    }

if __name__ == "__main__":
    improved = evaluate_improved_system()
    with open("scratch/improved_ocr_benchmark.json", "w") as f:
        json.dump(improved, f, indent=2)

    print("\n================== IMPROVED OCR BENCHMARK ==================")
    print(f"Readable Plates Tested:   {improved['readable_plates']}")
    print(f"Exact Matches:           {improved['exact_matches']} / {improved['readable_plates']}")
    print(f"Exact-Match Accuracy:    {improved['exact_match_accuracy_pct']}%")
    print(f"Mean Character Error (CER): {improved['mean_cer']}")
    print(f"OCR Coverage:            {improved['ocr_coverage_pct']}%")
    print(f"Average Latency:         {improved['average_latency_ms']} ms")
    print("-----------------------------------------------------------")
    for r in improved["details"]:
        status_sym = "[MATCH]" if r["exact_match"] else "[DIFF]"
        print(f"{status_sym} {r['id']:<26} GT: {str(r.get('ground_truth')):<14} -> Pred: {str(r.get('ocr_output')):<14} CER={r['cer']}")
