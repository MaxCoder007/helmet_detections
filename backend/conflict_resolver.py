"""
Helmet and No-Helmet Conflict Resolution Module for RoadVision AI.

Resolves spatial label conflicts when YOLO predicts both 'helmet' and 'no_helmet'
for the same physical head region with different confidence scores.

Algorithm:
1. Partitions detections into headwear ('helmet', 'no_helmet') and non-headwear
   ('rider', 'pillion', 'number_plate').
2. Compares headwear pairs that belong to opposing classes ('helmet' vs 'no_helmet').
3. Computes Intersection-over-Union (IoU), Containment (IoS), and relative horizontal center offset (rel_dx).
4. Conflict condition:
   - IoU >= conflict_iou_threshold (default: 0.40), OR
   - (Containment >= conflict_containment_threshold (default: 0.55) AND rel_dx < max_rel_dx (default: 0.35)), OR
   - Containment >= 0.75 (one prediction is largely nested inside the other, e.g. hairline/cap box).
5. If heads are horizontally separated (rel_dx >= max_rel_dx and IoU < conflict_iou_threshold),
   they represent distinct people (e.g. rider and pillion) and are NOT merged or suppressed.
6. Greedy conflict resolution: retains the prediction with higher confidence score; suppresses the lower-confidence counterpart.
7. Ambiguity tracking: if the confidence difference is marginal (|conf_a - conf_b| < ambiguity_conf_margin),
   marks the retained prediction as uncertain to prevent unjustified safety classifications.
8. Preserves all non-conflicting helmets and no-helmets.
9. Preserves all unrelated classes ('rider', 'pillion', 'number_plate') completely intact.
"""

from typing import List, Dict, Any, Tuple
import cv2
import numpy as np

from backend.duplicate_suppressor import compute_spatial_metrics


def compute_box_iou(boxA: List[float], boxB: List[float]) -> float:
    """
    Compute Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2].
    Maintained for direct backward compatibility.
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_w = max(0.0, xB - xA)
    inter_h = max(0.0, yB - yA)
    inter_area = inter_w * inter_h

    boxA_area = max(0.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxB_area = max(0.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    union_area = boxA_area + boxB_area - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def resolve_helmet_conflicts(
    detections: List[Dict[str, Any]],
    conflict_iou_threshold: float = 0.40,
    conflict_containment_threshold: float = 0.55,
    max_rel_dx: float = 0.35,
    ambiguity_conf_margin: float = 0.05,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Filters raw YOLO detections to eliminate conflicting overlapping predictions
    between 'helmet' and 'no_helmet' for the same physical head.

    Parameters:
    - detections: list of detection dictionaries, each containing:
        { "id", "class_id", "class_name", "confidence", "bbox": [x1, y1, x2, y2] }
    - conflict_iou_threshold: minimum IoU to consider two opposing headwear
        predictions as representing the same physical object (default: 0.40).
    - conflict_containment_threshold: minimum Containment for concentric headwear boxes (default: 0.55).
    - max_rel_dx: maximum relative horizontal center offset for same-head conflict (default: 0.35).
    - ambiguity_conf_margin: confidence gap threshold below which resolution is flagged as uncertain (default: 0.05).

    Returns:
    - filtered_detections: list of detections with conflicts resolved.
    - resolved_conflicts: audit list detailing which predictions were suppressed and why.
    """
    if not detections:
        return [], []

    # 1. Partition into headwear and non-headwear
    headwear_items = []
    other_items = []

    for d in detections:
        if d.get("class_name") in ("helmet", "no_helmet"):
            headwear_items.append(d)
        else:
            other_items.append(d)

    # If there are fewer than 2 headwear predictions, no opposing conflict can exist
    if len(headwear_items) < 2:
        sorted_dets = sorted(detections, key=lambda x: x.get("confidence", 0.0), reverse=True)
        return sorted_dets, []

    # Sort headwear by confidence descending for greedy conflict suppression
    headwear_sorted = sorted(headwear_items, key=lambda x: x.get("confidence", 0.0), reverse=True)

    suppressed_indices = set()
    resolved_conflicts = []

    n = len(headwear_sorted)
    for i in range(n):
        if i in suppressed_indices:
            continue

        item_a = headwear_sorted[i]
        class_a = item_a.get("class_name")
        conf_a = float(item_a.get("confidence", 0.0))
        box_a = item_a.get("bbox", [0, 0, 0, 0])

        for j in range(i + 1, n):
            if j in suppressed_indices:
                continue

            item_b = headwear_sorted[j]
            class_b = item_b.get("class_name")
            conf_b = float(item_b.get("confidence", 0.0))
            box_b = item_b.get("bbox", [0, 0, 0, 0])

            # Only compare opposing classes (helmet vs no_helmet)
            if class_a == class_b:
                continue

            iou, containment, rel_dx, rel_dy = compute_spatial_metrics(box_a, box_b)

            is_conflict = False
            reason = ""

            if iou >= conflict_iou_threshold:
                is_conflict = True
                reason = f"Overlapping opposing headwear: IoU {iou:.2f} >= {conflict_iou_threshold} ({class_a} {conf_a:.3f} > {class_b} {conf_b:.3f})"
            elif containment >= conflict_containment_threshold and rel_dx < max_rel_dx:
                is_conflict = True
                reason = f"Overlapping opposing headwear: Containment {containment:.2f} >= {conflict_containment_threshold}, rel_dx {rel_dx:.2f} < {max_rel_dx} ({class_a} {conf_a:.3f} > {class_b} {conf_b:.3f})"
            elif containment >= 0.75:
                is_conflict = True
                reason = f"Overlapping opposing headwear: High Containment {containment:.2f} >= 0.75 ({class_a} {conf_a:.3f} > {class_b} {conf_b:.3f})"

            if is_conflict:
                suppressed_indices.add(j)

                # Check if decision is ambiguous
                conf_diff = abs(conf_a - conf_b)
                is_uncertain = conf_diff < ambiguity_conf_margin
                if is_uncertain:
                    item_a["is_uncertain"] = True
                    item_a["uncertainty_reason"] = (
                        f"Close opposing prediction ({class_b} conf {conf_b*100:.1f}% vs {class_a} {conf_a*100:.1f}%)"
                    )

                resolved_conflicts.append({
                    "type": "helmet_conflict_resolution",
                    "retained": {
                        "id": item_a.get("id"),
                        "class_name": class_a,
                        "confidence": conf_a,
                        "bbox": box_a,
                        "is_uncertain": is_uncertain,
                    },
                    "suppressed": {
                        "id": item_b.get("id"),
                        "class_name": class_b,
                        "confidence": conf_b,
                        "bbox": box_b,
                    },
                    "iou": iou,
                    "containment": containment,
                    "rel_dx": rel_dx,
                    "rel_dy": rel_dy,
                    "confidence_diff": round(conf_diff, 4),
                    "is_uncertain": is_uncertain,
                    "reason": reason,
                })

    # Assemble retained headwear
    retained_headwear = [
        item for idx, item in enumerate(headwear_sorted)
        if idx not in suppressed_indices
    ]

    # Combine with untouched non-headwear items
    filtered_detections = other_items + retained_headwear

    # Sort final detections by confidence descending for consistent presentation
    filtered_detections.sort(key=lambda x: x.get("confidence", 0.0), reverse=True)

    return filtered_detections, resolved_conflicts


# Class-specific color palette in BGR for drawing on OpenCV images
CLASS_BGR_COLORS = {
    "helmet": (52, 211, 153),        # Emerald Green (#34D399) in BGR: (153, 211, 52)
    "no_helmet": (113, 113, 248),    # Coral Red (#F87171) in BGR: (113, 113, 248)
    "number_plate": (255, 232, 139), # Cyan (#8BE8FF) in BGR: (255, 232, 139)
    "pillion": (252, 171, 240),      # Pink (#F0ABFC) in BGR: (252, 171, 240)
    "rider": (250, 165, 96),         # Blue (#60A5FA) in BGR: (250, 165, 96)
}


def draw_annotated_detections(
    image: np.ndarray,
    detections: List[Dict[str, Any]],
    low_conf_threshold: float = 0.25
) -> np.ndarray:
    """
    Renders bounding boxes and label tags onto a copy of the input image
    using the exact post-processed detections list.

    Guarantees 100% visual consistency between API output and annotated image.
    Adds a '[Low Conf]' visual tag when prediction confidence is below low_conf_threshold.
    Adds a '[Uncertain]' visual tag when an opposing headwear conflict had ambiguous confidence.
    """
    canvas = image.copy()
    h, w = canvas.shape[:2]

    # Sort detections by box area descending so larger bounding boxes (e.g. rider/pillion)
    # are drawn first, and smaller tighter boxes (e.g. helmet, number_plate) are drawn on top.
    def get_box_area(d: Dict[str, Any]) -> float:
        b = d.get("bbox", [0, 0, 0, 0])
        return max(0.0, (b[2] - b[0]) * (b[3] - b[1]))

    sorted_dets = sorted(detections, key=get_box_area, reverse=True)

    for det in sorted_dets:
        cls_name = det.get("class_name", "object")
        conf = float(det.get("confidence", 0.0))
        bbox = det.get("bbox", [0, 0, 0, 0])
        is_uncertain = bool(det.get("is_uncertain", False))
        x1, y1, x2, y2 = [int(round(c)) for c in bbox]

        # Clamp coordinates to canvas
        x1 = max(0, min(w - 1, x1))
        y1 = max(0, min(h - 1, y1))
        x2 = max(0, min(w - 1, x2))
        y2 = max(0, min(h - 1, y2))

        color = CLASS_BGR_COLORS.get(cls_name, (200, 200, 200))

        # Box thickness: thicker for high confidence, lighter for low confidence
        thickness = 2 if conf >= low_conf_threshold else 1
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness)

        # Label text: e.g. "helmet 94.2%" or "no_helmet 8.5% [Low]"
        conf_pct = conf * 100
        if 0 < conf < 0.01:
            conf_str = f"{conf_pct:.2f}%"
        else:
            conf_str = f"{conf_pct:.1f}%"

        extra_tags = []
        if is_uncertain:
            extra_tags.append("[Uncertain]")
        elif conf < low_conf_threshold:
            extra_tags.append("[Low]")

        tag_str = f" {' '.join(extra_tags)}" if extra_tags else ""
        if cls_name == "number_plate" and det.get("ocr") and det["ocr"].get("text"):
            plate_text = det["ocr"]["text"]
            label = f"number_plate {conf_str} [{plate_text}]{tag_str}"
        else:
            label = f"{cls_name} {conf_str}{tag_str}"

        # Draw filled background pill for text readability
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.45
        font_thickness = 1
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, font_thickness)

        tag_y1 = max(0, y1 - th - 6)
        tag_y2 = y1
        tag_x1 = x1
        tag_x2 = min(w - 1, x1 + tw + 6)

        # Fill background tag with class color
        cv2.rectangle(canvas, (tag_x1, tag_y1), (tag_x2, tag_y2), color, -1)

        # Text in dark for high contrast against vivid class pills
        text_color = (0, 0, 0)
        cv2.putText(
            canvas,
            label,
            (tag_x1 + 3, tag_y2 - 3),
            font,
            font_scale,
            text_color,
            font_thickness,
            cv2.LINE_AA
        )

    return canvas
