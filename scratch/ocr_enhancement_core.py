import cv2
import numpy as np
import re
from typing import List, Tuple, Dict, Any, Optional

INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN", "GA", "GJ",
    "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP",
    "WB"
}

DIGIT_TO_LETTER = {'0': 'O', '1': 'I', '8': 'B', '5': 'S', '4': 'A', '2': 'Z', '6': 'G', '7': 'T'}
LETTER_TO_DIGIT = {'O': '0', 'D': '0', 'Q': '0', 'I': '1', 'L': '1', 'Z': '2', 'B': '8', 'S': '5', 'G': '6', 'T': '7'}

PATTERN_STANDARD = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$")
PATTERN_BHARAT = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")
PATTERN_LEGACY = re.compile(r"^[A-Z]{2,3}[0-9]{3,4}$")

DEALER_STOPWORDS = {"IND", "INDIA", "HONDA", "HERO", "BAJAJ", "YAMAHA", "TVS", "SUZUKI", "ROYAL", "ENFIELD", "DEALER"}

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
        pts = np.array(bbox, dtype=np.float32)
        x_min = float(np.min(pts[:, 0]))
        x_max = float(np.max(pts[:, 0]))
        y_min = float(np.min(pts[:, 1]))
        y_max = float(np.max(pts[:, 1]))
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
    lines = []
    for b in valid_boxes:
        matched_line = None
        for line in lines:
            line_y_avg = np.mean([item["y_center"] for item in line])
            line_h_avg = np.mean([item["h"] for item in line])
            # Generous vertical tolerance to group horizontally tilted or slight staggered tokens
            if abs(b["y_center"] - line_y_avg) <= (0.50 * line_h_avg):
                matched_line = line
                break
        if matched_line is not None:
            matched_line.append(b)
        else:
            lines.append([b])

    # Sort lines by average Y-center (top to bottom)
    lines.sort(key=lambda line: np.mean([b["y_center"] for b in line]))

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
            # Optimal candidate: valid state code + standard registration pattern
            score = (avg_conf * 1.5 + 0.6) * len_penalty
            return score, {"is_valid": True, "format_type": "standard", "state_code": state_code, "status": "valid"}
        else:
            score = (avg_conf * 1.1 + 0.2) * len_penalty
            return score, {"is_valid": True, "format_type": "standard", "state_code": state_code, "status": "uncertain"}

    if PATTERN_BHARAT.match(cleaned):
        score = (avg_conf * 1.5 + 0.5) * len_penalty
        return score, {"is_valid": True, "format_type": "bharat_series", "state_code": "BH", "status": "valid"}

    if PATTERN_LEGACY.match(cleaned):
        score = (avg_conf * 1.25 + 0.3) * len_penalty
        return score, {"is_valid": True, "format_type": "legacy", "state_code": state_code if is_valid_state else None, "status": "valid" if is_valid_state else "uncertain"}

    if 6 <= len(cleaned) <= 11 and any(c.isalpha() for c in cleaned) and any(c.isdigit() for c in cleaned):
        state_bonus = 0.35 if is_valid_state else 0.0
        score = (avg_conf * 0.85 + state_bonus) * len_penalty
        return score, {"is_valid": False, "format_type": "plausible", "state_code": state_code if is_valid_state else None, "status": "uncertain"}

    score = (avg_conf * 0.25) * len_penalty
    return score, {"is_valid": False, "format_type": "invalid", "state_code": None, "status": "invalid"}
