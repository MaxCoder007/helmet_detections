"""
Class-Aware Duplicate Detection Suppression Module for RoadVision AI.

Eliminates redundant bounding boxes for the same physical object across model predictions.
Operates strictly in a class-aware manner: overlapping boxes of different classes
(e.g., rider overlapping number_plate) are never suppressed against each other.

Key features:
1. Class-Aware: Only compares predictions sharing the identical class identity.
2. Dual Overlap Metrics:
   - Standard Intersection-over-Union (IoU)
   - Intersection-over-Min-Area (Containment / IoS)
3. Spatial Center Separation:
   - Evaluates relative horizontal center offset (rel_dx = dx / min(wA, wB)).
   - Distinguishes duplicate predictions of one head (rel_dx < 0.35) from separate distinct riders/passengers (rel_dx >= 0.35).
4. Specialized Small-Object Handling for Number Plates:
   - Number plates are small, compact, and elongated. Two predicted boxes for the same plate
     can have moderate IoU (~0.35 - 0.40) while one box is largely contained inside the other
     (containment >= 0.50).
5. Headwear Suppression Policy:
   - Merges redundant concentric helmet or no-helmet boxes on the same head.
   - Preserves multiple distinct people seated together or adjacent in traffic.
"""

from typing import List, Dict, Any, Tuple


def compute_box_metrics(boxA: List[float], boxB: List[float]) -> Tuple[float, float]:
    """
    Computes Intersection-over-Union (IoU) and Containment (Intersection-over-Min-Area)
    between two bounding boxes [x1, y1, x2, y2].

    Returns:
        (iou, containment) tuple as floats.
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
    iou = inter_area / union_area if union_area > 0 else 0.0

    min_area = min(boxA_area, boxB_area)
    containment = inter_area / min_area if min_area > 0 else 0.0

    return round(float(iou), 4), round(float(containment), 4)


def compute_spatial_metrics(boxA: List[float], boxB: List[float]) -> Tuple[float, float, float, float]:
    """
    Computes IoU, Containment, and relative center offsets between two boxes.

    Returns:
        (iou, containment, rel_dx, rel_dy) tuple as floats.
        - rel_dx: |center_x_A - center_x_B| / min(width_A, width_B)
        - rel_dy: |center_y_A - center_y_B| / min(height_A, height_B)
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_w = max(0.0, xB - xA)
    inter_h = max(0.0, yB - yA)
    inter_area = inter_w * inter_h

    wA = max(1e-6, boxA[2] - boxA[0])
    hA = max(1e-6, boxA[3] - boxA[1])
    wB = max(1e-6, boxB[2] - boxB[0])
    hB = max(1e-6, boxB[3] - boxB[1])

    boxA_area = max(0.0, wA * hA)
    boxB_area = max(0.0, wB * hB)

    union_area = boxA_area + boxB_area - inter_area
    iou = inter_area / union_area if union_area > 0 else 0.0

    min_area = min(boxA_area, boxB_area)
    containment = inter_area / min_area if min_area > 0 else 0.0

    cxA = (boxA[0] + boxA[2]) / 2.0
    cyA = (boxA[1] + boxA[3]) / 2.0
    cxB = (boxB[0] + boxB[2]) / 2.0
    cyB = (boxB[1] + boxB[3]) / 2.0

    dx = abs(cxA - cxB)
    dy = abs(cyA - cyB)
    rel_dx = dx / min(wA, wB)
    rel_dy = dy / min(hA, hB)

    return round(float(iou), 4), round(float(containment), 4), round(float(rel_dx), 4), round(float(rel_dy), 4)


def suppress_class_duplicates(
    detections: List[Dict[str, Any]],
    plate_iou: float = 0.35,
    plate_containment: float = 0.50,
    headwear_iou: float = 0.40,
    headwear_containment: float = 0.55,
    headwear_max_rel_dx: float = 0.35,
    general_iou: float = 0.45,
    general_containment: float = 0.65,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Suppresses redundant duplicate detections of the SAME class.

    Parameters:
        detections: List of detection dicts with keys:
                    { "id", "class_id", "class_name", "confidence", "bbox": [x1, y1, x2, y2] }
        plate_iou: IoU threshold for number_plate duplicate suppression (default: 0.35).
        plate_containment: Containment threshold for number_plate (default: 0.50).
        headwear_iou: IoU threshold for helmet/no_helmet duplicates (default: 0.40).
        headwear_containment: Containment threshold for headwear (default: 0.55).
        headwear_max_rel_dx: Maximum relative horizontal center offset for same-head duplicate (default: 0.35).
        general_iou: IoU threshold for other classes (default: 0.45).
        general_containment: Containment threshold for other classes (default: 0.65).

    Returns:
        (retained_detections, suppressed_audit_log)
    """
    if not detections:
        return [], []

    # Sort candidates by confidence descending
    sorted_dets = sorted(detections, key=lambda x: x.get("confidence", 0.0), reverse=True)

    retained: List[Dict[str, Any]] = []
    suppressed_log: List[Dict[str, Any]] = []
    suppressed_indices = set()

    n = len(sorted_dets)
    for i in range(n):
        if i in suppressed_indices:
            continue

        item_a = sorted_dets[i]
        retained.append(item_a)

        cls_a = item_a.get("class_name")
        box_a = item_a.get("bbox", [0, 0, 0, 0])
        conf_a = float(item_a.get("confidence", 0.0))
        id_a = item_a.get("id", f"det_{i}")

        for j in range(i + 1, n):
            if j in suppressed_indices:
                continue

            item_b = sorted_dets[j]
            cls_b = item_b.get("class_name")

            # STRICT CLASS IDENTITY: never suppress across different classes
            if cls_a != cls_b:
                continue

            box_b = item_b.get("bbox", [0, 0, 0, 0])
            conf_b = float(item_b.get("confidence", 0.0))
            id_b = item_b.get("id", f"det_{j}")

            iou, containment, rel_dx, rel_dy = compute_spatial_metrics(box_a, box_b)

            is_duplicate = False
            reason = ""

            if cls_a == "number_plate":
                if iou >= plate_iou:
                    is_duplicate = True
                    reason = f"Duplicate number_plate: IoU {iou:.2f} >= {plate_iou} with {id_a} ({conf_a * 100:.1f}%)"
                elif containment >= plate_containment:
                    is_duplicate = True
                    reason = f"Duplicate number_plate: Containment {containment:.2f} >= {plate_containment} with {id_a} ({conf_a * 100:.1f}%)"
            elif cls_a in ("helmet", "no_helmet"):
                if iou >= headwear_iou:
                    is_duplicate = True
                    reason = f"Duplicate {cls_a}: IoU {iou:.2f} >= {headwear_iou} with {id_a} ({conf_a * 100:.1f}%)"
                elif containment >= headwear_containment and rel_dx < headwear_max_rel_dx:
                    is_duplicate = True
                    reason = f"Duplicate {cls_a}: Containment {containment:.2f} >= {headwear_containment}, rel_dx {rel_dx:.2f} < {headwear_max_rel_dx} with {id_a} ({conf_a * 100:.1f}%)"
                elif containment >= 0.75:
                    is_duplicate = True
                    reason = f"Duplicate {cls_a}: High Containment {containment:.2f} >= 0.75 with {id_a} ({conf_a * 100:.1f}%)"
            else:
                if iou >= general_iou:
                    is_duplicate = True
                    reason = f"Duplicate {cls_a}: IoU {iou:.2f} >= {general_iou} with {id_a} ({conf_a * 100:.1f}%)"
                elif containment >= general_containment:
                    is_duplicate = True
                    reason = f"Duplicate {cls_a}: Containment {containment:.2f} >= {general_containment} with {id_a} ({conf_a * 100:.1f}%)"

            if is_duplicate:
                suppressed_indices.add(j)
                suppressed_log.append({
                    "type": "duplicate_suppression",
                    "retained": {
                        "id": id_a,
                        "class_name": cls_a,
                        "confidence": conf_a,
                        "bbox": box_a,
                    },
                    "suppressed": {
                        "id": id_b,
                        "class_name": cls_b,
                        "confidence": conf_b,
                        "bbox": box_b,
                    },
                    "iou": iou,
                    "containment": containment,
                    "rel_dx": rel_dx,
                    "rel_dy": rel_dy,
                    "reason": reason,
                })

    return retained, suppressed_log
