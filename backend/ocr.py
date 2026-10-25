"""
Number Plate Detection and OCR Module for RoadVision AI.

Performs:
1. Cropping detected number plate bounding boxes from source images with adaptive padding.
2. Validating and clamping coordinates within image boundaries to prevent out-of-bounds crops.
3. Multi-variant preprocessing (Sharpened Normalized Grayscale, CLAHE contrast enhancement).
4. Text extraction via EasyOCR with thread-safe singleton reader and tuned confidence/link thresholds.
5. 2D geometric token clustering and natural reading order (top-to-bottom, left-to-right) for two-line plates.
6. HSRP 'IND' badge, perimeter logo, and dealer stopword filtering.
7. Positional character confusion hypothesis generation (0/O, 1/I, 8/B, 5/S, 4/A, 2/Z).
8. Multi-candidate scoring combining recognition confidence with Indian registration syntax rules.
9. Honest unreadable plate detection without character fabrication or hallucination.
"""

import re
import base64
import threading
from typing import Dict, Any, Optional, Tuple, List
import cv2
import numpy as np

# EasyOCR reader singleton & concurrency locks
_ocr_init_lock = threading.Lock()
_ocr_inference_lock = threading.Lock()
_easyocr_reader = None
_ocr_disabled = False


def get_ocr_reader():
    """
    Thread-safe lazy initialization of EasyOCR reader instance.
    Reuses a single model instance across requests.
    """
    global _easyocr_reader, _ocr_disabled
    if _ocr_disabled:
        return None

    if _easyocr_reader is None:
        with _ocr_init_lock:
            if _easyocr_reader is None and not _ocr_disabled:
                try:
                    import easyocr
                    # Initialize with English, CPU execution, verbose=False
                    _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                except Exception as e:
                    print(f"[ERROR] Failed to initialize EasyOCR: {e}")
                    _easyocr_reader = None
    return _easyocr_reader


def set_ocr_reader_for_testing(mock_reader):
    """Allow injecting a mock reader for unit tests without downloading weights."""
    global _easyocr_reader
    _easyocr_reader = mock_reader


# Valid Indian State and Union Territory 2-letter codes
INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN", "GA", "GJ",
    "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP",
    "WB"
}

# Positional character confusion mappings
DIGIT_TO_LETTER = {
    '0': 'O', '1': 'I', '8': 'B', '5': 'S', '4': 'A', '2': 'Z', '6': 'G', '7': 'T'
}
LETTER_TO_DIGIT = {
    'O': '0', 'D': '0', 'Q': '0', 'I': '1', 'L': '1', 'Z': '2', 'B': '8', 'S': '5', 'G': '6', 'T': '7'
}

# Dealer brands and noise stopwords often printed on plate margins
DEALER_STOPWORDS = {
    "IND", "INDIA", "HONDA", "HERO", "BAJAJ", "YAMAHA", "TVS", "SUZUKI",
    "ROYAL", "ENFIELD", "DEALER", "MOTORS", "AUTOMOBILES"
}

# Regex patterns for Indian vehicle registration formats
# Standard: KA01AB1234, DL8CAF5030, MH12DE1433, KA011234 (1-2 district digits, 0-3 series letters, 1-4 serial digits)
PATTERN_STANDARD = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$")
# Bharat Series: 22BH1234AA (2 digit year, BH, 4 digits, 1-2 letters)
PATTERN_BHARAT = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")
# Legacy / Vintage formats: e.g. DLA1234, KA011234
PATTERN_LEGACY = re.compile(r"^[A-Z]{2,3}[0-9]{3,4}$")


def preprocess_variant_clahe(crop: np.ndarray) -> np.ndarray:
    """
    Variant A: CLAHE contrast enhancement + bilateral filtering.
    - Upscale small crops to optimal character height (95px).
    - CLAHE (clipLimit=2.2, 8x8 grid).
    - Bilateral filter to smooth sensor noise while preserving character edges.
    """
    if crop is None or crop.size == 0:
        return crop

    h, w = crop.shape[:2]
    scale = max(1.5, min(3.5, 95.0 / h)) if h < 80 else (240.0 / h if h > 250 else 1.0)
    resized = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized

    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)


def preprocess_variant_sharpen(crop: np.ndarray) -> np.ndarray:
    """
    Variant B: Normalized Grayscale + Unsharp Masking.
    - Upscale small crops to optimal character height (95px).
    - Min-max contrast stretch to utilize full 0-255 dynamic range.
    - Gaussian unsharp mask to accentuate high-frequency stroke edges without binarization noise.
    """
    if crop is None or crop.size == 0:
        return crop

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


def preprocess_variant_otsu(crop: np.ndarray) -> np.ndarray:
    """
    Variant C: Adaptive/Otsu Thresholding.
    - Upscale small crops to optimal character height (95px).
    - Gaussian blur followed by Otsu binarization.
    """
    if crop is None or crop.size == 0:
        return crop

    h, w = crop.shape[:2]
    scale = max(1.5, min(3.5, 95.0 / h)) if h < 80 else (240.0 / h if h > 250 else 1.0)
    resized = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized

    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def preprocess_plate_image(crop: np.ndarray) -> np.ndarray:
    """
    Default plate enhancement function (backwards-compatible alias for Variant A CLAHE).
    """
    return preprocess_variant_clahe(crop)


def normalize_ocr_text(raw_text: str) -> str:
    """
    Normalize raw OCR string:
    - Strip whitespaces, hyphens, dots, and non-alphanumeric noise.
    - Convert to uppercase.
    - Does NOT fabricate or force characters into patterns.
    """
    if not raw_text:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()


def validate_indian_registration(text: str) -> Dict[str, Any]:
    """
    Validate normalized plate string against Indian registration conventions.
    Returns:
    {
        "is_valid": bool,
        "format_type": "standard" | "bharat_series" | "legacy" | "plausible" | "invalid" | "empty",
        "state_code": Optional[str],
        "state_verified": bool,
        "status": "valid" | "invalid" | "uncertain"
    }
    """
    cleaned = normalize_ocr_text(text)
    if not cleaned:
        return {
            "is_valid": False,
            "format_type": "empty",
            "state_code": None,
            "state_verified": False,
            "status": "invalid"
        }

    # 1. Standard format check (e.g. KA01AB1234, DL8CAF5030, MH12DE1433, KA011234)
    if PATTERN_STANDARD.match(cleaned):
        state = cleaned[:2]
        state_verified = state in INDIAN_STATE_CODES
        return {
            "is_valid": True,
            "format_type": "standard",
            "state_code": state,
            "state_verified": state_verified,
            "status": "valid" if state_verified else "uncertain"
        }

    # 2. Bharat series format check (e.g. 22BH1234AA)
    if PATTERN_BHARAT.match(cleaned):
        return {
            "is_valid": True,
            "format_type": "bharat_series",
            "state_code": "BH",
            "state_verified": True,
            "status": "valid"
        }

    # 3. Legacy / Vintage format check (e.g. DLA1234, KA011234)
    if PATTERN_LEGACY.match(cleaned):
        state = cleaned[:2]
        state_verified = state in INDIAN_STATE_CODES
        return {
            "is_valid": True,
            "format_type": "legacy",
            "state_code": state if state_verified else None,
            "state_verified": state_verified,
            "status": "valid" if state_verified else "uncertain"
        }

    # 4. Plausible alphanumeric sequence (e.g. partially occluded or customized plate)
    if 6 <= len(cleaned) <= 12 and any(c.isalpha() for c in cleaned) and any(c.isdigit() for c in cleaned):
        return {
            "is_valid": False,
            "format_type": "plausible",
            "state_code": cleaned[:2] if cleaned[:2] in INDIAN_STATE_CODES else None,
            "state_verified": cleaned[:2] in INDIAN_STATE_CODES,
            "status": "uncertain"
        }

    return {
        "is_valid": False,
        "format_type": "invalid",
        "state_code": None,
        "state_verified": False,
        "status": "invalid"
    }


def _parse_box_coordinates(bbox: Any) -> Optional[Tuple[float, float, float, float]]:
    """Parse bounding box in polygon [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] or [x1,y1,x2,y2] format."""
    try:
        pts = np.array(bbox, dtype=np.float32)
        if pts.ndim == 2 and pts.shape[0] >= 3:
            x_min = float(np.min(pts[:, 0]))
            x_max = float(np.max(pts[:, 0]))
            y_min = float(np.min(pts[:, 1]))
            y_max = float(np.max(pts[:, 1]))
            return x_min, y_min, x_max, y_max
        elif pts.ndim == 1 and pts.shape[0] >= 4:
            x1, y1, x2, y2 = pts[:4]
            return float(min(x1, x2)), float(min(y1, y2)), float(max(x1, x2)), float(max(y1, y2))
    except Exception:
        pass
    return None


def order_tokens_into_reading_sequence(raw_results: List[Any]) -> List[Tuple[str, float, List[float]]]:
    """
    Sort EasyOCR detected bounding boxes into natural 2D reading order:
    1. Filter out HSRP 'IND' badges, frame screws, and dealer logos.
    2. Cluster boxes into horizontal lines based on vertical overlap / Y-center proximity.
    3. Sort lines top-to-bottom.
    4. Sort tokens within each line left-to-right.
    """
    if not raw_results:
        return []

    boxes_info = []
    for item in raw_results:
        if len(item) < 3:
            continue
        bbox, text, conf = item[:3]
        coords = _parse_box_coordinates(bbox)
        if coords is None:
            continue
        x_min, y_min, x_max, y_max = coords
        y_center = (y_min + y_max) / 2.0
        x_center = (x_min + x_max) / 2.0
        h = max(1.0, y_max - y_min)
        w = max(1.0, x_max - x_min)

        clean_t = re.sub(r"[^A-Za-z0-9]", "", str(text)).upper()
        if not clean_t:
            continue

        # Drop HSRP country badges (e.g. 'IND', 'INDT', 'IN')
        if clean_t.startswith("IND") or (clean_t == "IN" and float(conf) < 0.60):
            continue

        # Drop dealer stop words
        if clean_t in DEALER_STOPWORDS and float(conf) < 0.85:
            continue

        boxes_info.append({
            "text": clean_t,
            "raw_text": str(text),
            "conf": float(conf),
            "x_min": x_min,
            "x_max": x_max,
            "y_min": y_min,
            "y_max": y_max,
            "x_center": x_center,
            "y_center": y_center,
            "w": w,
            "h": h
        })

    if not boxes_info:
        return []

    # Drop outlier noise tokens whose height is tiny relative to median character height
    all_heights = [b["h"] for b in boxes_info]
    median_h = float(np.median(all_heights)) if all_heights else 20.0

    valid_boxes = []
    for b in boxes_info:
        if len(b["text"]) <= 3 and b["h"] < (0.35 * median_h) and b["conf"] < 0.50:
            continue
        valid_boxes.append(b)

    if not valid_boxes:
        valid_boxes = boxes_info

    # Sort initially by Y-center
    valid_boxes.sort(key=lambda b: b["y_center"])

    # Group into lines
    lines: List[List[Dict[str, Any]]] = []
    for b in valid_boxes:
        matched_line = None
        for line in lines:
            line_y_avg = float(np.mean([item["y_center"] for item in line]))
            line_h_avg = float(np.mean([item["h"] for item in line]))
            # Group tokens belonging to the same horizontal text line
            if abs(b["y_center"] - line_y_avg) <= (0.50 * line_h_avg):
                matched_line = line
                break
        if matched_line is not None:
            matched_line.append(b)
        else:
            lines.append([b])

    # Sort lines by average Y-center (top to bottom)
    lines.sort(key=lambda line: float(np.mean([b["y_center"] for b in line])))

    ordered_tokens = []
    for line in lines:
        line.sort(key=lambda b: b["x_min"])
        for b in line:
            ordered_tokens.append((b["text"], b["conf"], [b["x_min"], b["y_min"], b["x_max"], b["y_max"]]))

    return ordered_tokens


def extract_plate_substrings(raw_str: str) -> List[str]:
    """
    Extract sub-sequences that match potential Indian registration prefixes:
    Removes leading frame/dealer badges (e.g. '6L7', 'INO', '4O', 'RB', 'CK').
    """
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_str).upper()
    if len(cleaned) < 5:
        return [cleaned]

    candidates = [cleaned]

    # Look for valid 2-letter state codes in the string, or state codes with 1 digit substitution (e.g. K4->KA, 0L->DL)
    for i in range(len(cleaned) - 4):
        c0 = cleaned[i]
        c1 = cleaned[i+1]
        c0_c = DIGIT_TO_LETTER.get(c0, c0)
        c1_c = DIGIT_TO_LETTER.get(c1, c1)
        cand_sc = c0_c + c1_c
        if cand_sc in INDIAN_STATE_CODES:
            sub = cand_sc + cleaned[i+2:]
            if sub not in candidates:
                candidates.append(sub)
            if cleaned[i:] not in candidates:
                candidates.append(cleaned[i:])

    # Look for Bharat series prefix (e.g. 22BH...)
    bh_match = re.search(r"[0-9]{2}BH", cleaned)
    if bh_match:
        sub_bh = cleaned[bh_match.start():]
        if sub_bh not in candidates:
            candidates.append(sub_bh)

    return candidates


def generate_registration_hypotheses(raw_plate: str) -> List[str]:
    """
    Generate plausible character-confusion hypotheses for Indian registration syntax:
    - Position 0-1: State code letters (0->O, 1->I, 8->B, 5->S, 4->A, 2->Z)
    - Position 2-3: District code digits (O->0, D->0, Q->0, I->1, L->1, B->8, S->5, Z->2)
    - Trailing 4 positions: Serial digits (O->0, I->1, B->8, S->5, Z->2, A->4, G->6)
    """
    base_strings = extract_plate_substrings(raw_plate)
    hypotheses = list(base_strings)

    for base in base_strings:
        if len(base) < 5:
            continue

        chars = list(base)
        n = len(chars)

        # 1. State code correction (first 2 chars)
        c0 = chars[0]
        c1 = chars[1]
        c0_c = DIGIT_TO_LETTER.get(c0, c0)
        c1_c = DIGIT_TO_LETTER.get(c1, c1)
        cand_state = c0_c + c1_c
        if cand_state in INDIAN_STATE_CODES:
            chars[0] = c0_c
            chars[1] = c1_c

        # 2. District code correction (chars 2 and 3)
        if n >= 6:
            if chars[2] in LETTER_TO_DIGIT:
                chars[2] = LETTER_TO_DIGIT[chars[2]]
            if n >= 7 and chars[3] in LETTER_TO_DIGIT and chars[3] != 'I' and not (n >= 8 and chars[4].isdigit()):
                chars[3] = LETTER_TO_DIGIT[chars[3]]

            # 3. Trailing serial numbers (last 4 chars)
            for i in range(max(2, n - 4), n):
                if chars[i] in LETTER_TO_DIGIT:
                    chars[i] = LETTER_TO_DIGIT[chars[i]]

        h_str = "".join(chars)
        if h_str not in hypotheses:
            hypotheses.append(h_str)

    return hypotheses


def score_plate_candidate(candidate: str, avg_conf: float) -> Tuple[float, Dict[str, Any]]:
    """
    Score a plate candidate combining EasyOCR recognition confidence with format validity:
    - Valid standard format with verified state code: highest score
    - Valid Bharat or Legacy format: high score
    - Plausible format: moderate score
    - Invalid format: penalized score
    """
    cleaned = re.sub(r"[^A-Za-z0-9]", "", candidate).upper()
    if not cleaned:
        return 0.0, {"is_valid": False, "format_type": "empty", "status": "invalid"}

    state_code = cleaned[:2]
    is_valid_state = state_code in INDIAN_STATE_CODES

    # Length sanity check: standard Indian registrations are 6 to 10 characters (rarely 11)
    len_penalty = 1.0
    if len(cleaned) < 6 or len(cleaned) > 11:
        len_penalty = 0.45

    if PATTERN_STANDARD.match(cleaned):
        if is_valid_state:
            score = (avg_conf * 1.5 + 0.60) * len_penalty
            return score, {"is_valid": True, "format_type": "standard", "state_code": state_code, "status": "valid"}
        else:
            score = (avg_conf * 1.1 + 0.20) * len_penalty
            return score, {"is_valid": True, "format_type": "standard", "state_code": state_code, "status": "uncertain"}

    if PATTERN_BHARAT.match(cleaned):
        score = (avg_conf * 1.5 + 0.50) * len_penalty
        return score, {"is_valid": True, "format_type": "bharat_series", "state_code": "BH", "status": "valid"}

    if PATTERN_LEGACY.match(cleaned):
        score = (avg_conf * 1.25 + 0.30) * len_penalty
        return score, {"is_valid": True, "format_type": "legacy", "state_code": state_code if is_valid_state else None, "status": "valid" if is_valid_state else "uncertain"}

    if 6 <= len(cleaned) <= 11 and any(c.isalpha() for c in cleaned) and any(c.isdigit() for c in cleaned):
        state_bonus = 0.35 if is_valid_state else 0.0
        score = (avg_conf * 0.85 + state_bonus) * len_penalty
        return score, {"is_valid": False, "format_type": "plausible", "state_code": state_code if is_valid_state else None, "status": "uncertain"}

    score = (avg_conf * 0.25) * len_penalty
    return score, {"is_valid": False, "format_type": "invalid", "state_code": None, "status": "invalid"}


def encode_image_base64(img_bgr: np.ndarray) -> str:
    """Encode OpenCV BGR image as base64 JPEG string for client preview."""
    try:
        if img_bgr is None or img_bgr.size == 0:
            return ""
        success, encoded = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if success:
            return base64.b64encode(encoded.tobytes()).decode("utf-8")
    except Exception:
        pass
    return ""


def clamp_and_crop_bbox(
    image: np.ndarray,
    bbox: List[float],
    padding_x_pct: float = 0.08,
    padding_y_pct: float = 0.10
) -> Tuple[Optional[np.ndarray], List[int]]:
    """
    Validate, clamp coordinates within image bounds, add adaptive margin padding, and extract crop.
    Returns (crop_bgr, clamped_bbox).
    """
    if image is None or image.size == 0 or len(bbox) < 4:
        return None, [0, 0, 0, 0]

    img_h, img_w = image.shape[:2]
    raw_x1, raw_y1, raw_x2, raw_y2 = bbox[:4]

    # Handle inverted or negative coordinates
    x1 = int(round(min(raw_x1, raw_x2)))
    y1 = int(round(min(raw_y1, raw_y2)))
    x2 = int(round(max(raw_x1, raw_x2)))
    y2 = int(round(max(raw_y1, raw_y2)))

    # Check if completely outside image
    if x2 <= 0 or y2 <= 0 or x1 >= img_w or y1 >= img_h or (x2 - x1) <= 0 or (y2 - y1) <= 0:
        return None, [max(0, min(img_w, x1)), max(0, min(img_h, y1)), max(0, min(img_w, x2)), max(0, min(img_h, y2))]

    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)
    pad_x = int(box_w * padding_x_pct)
    pad_y = int(box_h * padding_y_pct)

    crop_x1 = max(0, x1 - pad_x)
    crop_y1 = max(0, y1 - pad_y)
    crop_x2 = min(img_w, x2 + pad_x)
    crop_y2 = min(img_h, y2 + pad_y)

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        return None, [x1, y1, x2, y2]

    crop = image[crop_y1:crop_y2, crop_x1:crop_x2].copy()
    return crop, [x1, y1, x2, y2]


def extract_number_plate_ocr(
    image: np.ndarray,
    bbox: List[float],
    min_confidence: float = 0.20
) -> Dict[str, Any]:
    """
    Perform number plate cropping and OCR extraction:
    1. Validates and clamps bounding box coordinates with adaptive padding.
    2. Runs multi-variant preprocessing (Sharpened, CLAHE).
    3. Runs EasyOCR reader with thread-safety and optimized parameter tuning.
    4. Orders tokens in 2D reading sequence (two-line plate support).
    5. Strips HSRP badges and perimeter noise.
    6. Generates position-aware character confusion hypotheses.
    7. Evaluates and scores candidates combining confidence and format validity.
    8. Returns comprehensive, honest OCR result.
    """
    crop_bgr, clamped_bbox = clamp_and_crop_bbox(image, bbox)
    x1, y1, x2, y2 = clamped_bbox

    if crop_bgr is None or crop_bgr.size == 0:
        return {
            "text": None,
            "confidence": None,
            "format_valid": None,
            "status": "unreadable",
            "format_type": "invalid_coordinates",
            "raw_text": "",
            "crop_base64": "",
            "plate_bbox": clamped_bbox,
            "notes": "Invalid or out-of-bounds bounding box coordinates.",
            "review_required": True,
            "registration_number": None,
            "ocr_status": "unreadable",
            "ocr_confidence": 0.0,
            "raw_ocr_text": "",
            "validation_format": "invalid_coordinates"
        }

    crop_h, crop_w = crop_bgr.shape[:2]
    crop_base64 = encode_image_base64(crop_bgr)

    # Check for tiny or degenerate crops
    if crop_h < 12 or crop_w < 25:
        return {
            "text": None,
            "confidence": None,
            "format_valid": None,
            "status": "unreadable",
            "format_type": "too_small",
            "raw_text": "",
            "crop_base64": crop_base64,
            "plate_bbox": clamped_bbox,
            "notes": "Plate crop resolution is too small (< 12px height or < 25px width) for reliable OCR.",
            "review_required": True,
            "registration_number": None,
            "ocr_status": "unreadable",
            "ocr_confidence": 0.0,
            "raw_ocr_text": "",
            "validation_format": "too_small"
        }

    reader = get_ocr_reader()
    if reader is None:
        return {
            "text": None,
            "confidence": None,
            "format_valid": None,
            "status": "error",
            "format_type": "ocr_unavailable",
            "raw_text": "",
            "crop_base64": crop_base64,
            "plate_bbox": clamped_bbox,
            "notes": "EasyOCR engine could not be initialized or is unavailable.",
            "review_required": True,
            "registration_number": None,
            "ocr_status": "unreadable",
            "ocr_confidence": 0.0,
            "raw_ocr_text": "",
            "validation_format": "ocr_unavailable"
        }

    # Preprocessing passes: Pass 1 (Sharpened) -> Pass 2 (CLAHE)
    variants = [
        ("sharpen", preprocess_variant_sharpen(crop_bgr)),
        ("clahe", preprocess_variant_clahe(crop_bgr)),
    ]

    all_scored_candidates = []

    with _ocr_inference_lock:
        for v_name, v_img in variants:
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
                # If mock or specific reader doesn't support custom kwargs, fallback to basic readtext call
                try:
                    raw_ocr = reader.readtext(
                        v_img,
                        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -",
                        paragraph=False
                    )
                except Exception as inner_e:
                    print(f"[WARN] OCR processing exception: {inner_e}")
                    return {
                        "text": None,
                        "confidence": None,
                        "format_valid": None,
                        "status": "error",
                        "format_type": "inference_error",
                        "raw_text": "",
                        "crop_base64": crop_base64,
                        "plate_bbox": clamped_bbox,
                        "notes": f"OCR extraction error: {str(inner_e)}",
                        "review_required": True,
                        "registration_number": None,
                        "ocr_status": "unreadable",
                        "ocr_confidence": 0.0,
                        "raw_ocr_text": "",
                        "validation_format": "inference_error"
                    }

            if not raw_ocr:
                continue

            # 1. Order tokens into 2D reading sequence (two-line plate support)
            ordered_tokens = order_tokens_into_reading_sequence(raw_ocr)
            if not ordered_tokens:
                continue

            # Filter low-confidence noise tokens
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

            # 2. Generate and score hypotheses
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

            # Early exit if Pass 1 found a valid standard plate with high confidence (>= 0.60)
            if all_scored_candidates and any(c["meta"]["is_valid"] and c["avg_conf"] >= 0.60 for c in all_scored_candidates):
                break

    if not all_scored_candidates:
        return {
            "text": None,
            "confidence": None,
            "format_valid": None,
            "status": "unreadable",
            "format_type": "no_text_detected",
            "raw_text": "",
            "crop_base64": crop_base64,
            "plate_bbox": clamped_bbox,
            "notes": "Plate detected by YOLO11n, but text characters could not be extracted (blurred, occluded, or low contrast).",
            "review_required": True,
            "registration_number": None,
            "ocr_status": "unreadable",
            "ocr_confidence": 0.0,
            "raw_ocr_text": "",
            "validation_format": "no_text_detected"
        }

    # Sort candidates by combined score descending
    all_scored_candidates.sort(key=lambda c: c["score"], reverse=True)
    best = all_scored_candidates[0]

    best_text = best["candidate"]
    best_conf = round(best["avg_conf"], 4)
    best_meta = best["meta"]
    is_format_valid = best_meta["is_valid"]
    format_type = best_meta["format_type"]
    state_code = best_meta.get("state_code")
    state_verified = state_code in INDIAN_STATE_CODES if state_code else False

    # Status determination
    if best_conf >= min_confidence:
        status_str = "success"
        reg_number = best_text
        review_required = (not is_format_valid) or (best_conf < 0.60)
    else:
        status_str = "unreadable"
        reg_number = None
        review_required = True

    # Legacy status mapping for association and storage records
    if is_format_valid and best_conf >= min_confidence:
        legacy_ocr_status = "recognized"
    elif format_type == "plausible" and best_conf >= min_confidence:
        legacy_ocr_status = "unvalidated"
    else:
        legacy_ocr_status = "unreadable"

    return {
        "text": reg_number,
        "confidence": best_conf if status_str == "success" else None,
        "format_valid": is_format_valid,
        "status": status_str,
        "format_type": format_type,
        "raw_text": best["raw_joined"],
        "crop_base64": crop_base64,
        "plate_bbox": clamped_bbox,
        "state_code": state_code,
        "state_verified": state_verified,
        "review_required": review_required,
        "notes": f"Format: {format_type} ({'valid' if is_format_valid else 'unverified'}), OCR confidence: {round(best_conf * 100, 1)}% [Pass: {best['variant']}]",
        "registration_number": reg_number,
        "ocr_status": legacy_ocr_status,
        "ocr_confidence": best_conf,
        "raw_ocr_text": best["raw_joined"],
        "validation_format": format_type,
    }
