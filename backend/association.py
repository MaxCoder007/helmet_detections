"""
Rider-to-Plate and Helmet Association Module for RoadVision AI.

Solves the multi-object association problem for motorcycle traffic scenes:
1. Associates detected headwear (helmet / no_helmet) with riders and pillion passengers.
2. Associates vehicle registration plates (number_plate) with riders using spatial geometry.
3. Detects ambiguous scenes (e.g. multiple riders equidistant to a plate) and flags
   'uncertain' association rather than guessing.
4. Determines helmet compliance status and flags violation candidates strictly when
   visual evidence supports reliable association.
"""

from typing import List, Dict, Any, Optional, Tuple
import math


def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    """Calculate Intersection over Union (IoU) between two boxes [x1, y1, x2, y2]."""
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


def box_center(box: List[float]) -> Tuple[float, float]:
    """Return (center_x, center_y) for box [x1, y1, x2, y2]."""
    return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)


def box_dimensions(box: List[float]) -> Tuple[float, float]:
    """Return (width, height) for box [x1, y1, x2, y2]."""
    return (max(1.0, box[2] - box[0]), max(1.0, box[3] - box[1]))


def associate_helmets_to_riders(
    riders: List[Dict[str, Any]],
    headwear: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Associate helmet or no_helmet detections with riders/pillions.
    Physical rule:
    - Helmet/no_helmet must be horizontally centered near rider column:
      rider_x1 - 0.2*w <= head_cx <= rider_x2 + 0.2*w
    - Helmet/no_helmet must be positioned in the upper portion of the rider:
      rider_y1 - 0.2*h <= head_cy <= rider_y1 + 0.45*h
    """
    associated_riders = []

    for r in riders:
        r_box = r["bbox"]
        rx1, ry1, rx2, ry2 = r_box
        rw, rh = box_dimensions(r_box)
        rcx, _ = box_center(r_box)

        best_headwear = None
        best_score = float("inf")

        for h in headwear:
            h_box = h["bbox"]
            hcx, hcy = box_center(h_box)
            hw, hh = box_dimensions(h_box)

            # Check vertical containment (head is in top 45% of rider)
            vert_valid = (ry1 - 0.25 * rh) <= hcy <= (ry1 + 0.50 * rh)
            # Check horizontal containment
            horiz_valid = (rx1 - 0.25 * rw) <= hcx <= (rx2 + 0.25 * rw)

            if vert_valid and horiz_valid:
                # Calculate alignment cost
                dx = abs(hcx - rcx) / rw
                dy = abs(hcy - (ry1 + 0.15 * rh)) / rh
                cost = math.sqrt(dx * dx + dy * dy)

                if cost < best_score:
                    best_score = cost
                    best_headwear = h

        # Determine rider helmet state
        if best_headwear is not None:
            status = "helmet_detected" if best_headwear["class_name"] == "helmet" else "no_helmet_detected"
            confidence = best_headwear["confidence"]
            head_box = best_headwear["bbox"]
        else:
            status = "uncertain"
            confidence = 0.0
            head_box = None

        associated_riders.append({
            "rider": r,
            "helmet_status": status,
            "helmet_confidence": confidence,
            "helmet_bbox": head_box,
            "associated_headwear": best_headwear,
        })

    return associated_riders


def associate_plates_to_riders(
    plates: List[Dict[str, Any]],
    associated_riders: List[Dict[str, Any]],
    img_width: int,
    img_height: int
) -> List[Dict[str, Any]]:
    """
    Associate number plates with riders / motorcycles:
    Physical rules for motorcycle traffic:
    1. Plate is positioned lower than or at the base of the rider.
    2. Plate is horizontally aligned with the motorcycle / rider body.
    3. If multiple riders compete for the same plate with similar geometric cost,
       flag the association as 'uncertain' to avoid wrongful penalty attribution.
    4. If no rider is in proximity to the plate, flag as 'no_rider'.
    """
    records = []
    used_rider_indices = set()

    for p_idx, plate_info in enumerate(plates):
        p_box = plate_info["plate_bbox"]
        pcx, pcy = box_center(p_box)
        pw, ph = box_dimensions(p_box)

        candidate_costs = []

        for r_idx, r_data in enumerate(associated_riders):
            r_box = r_data["rider"]["bbox"]
            rx1, ry1, rx2, ry2 = r_box
            rw, rh = box_dimensions(r_box)
            rcx, rcy = box_center(r_box)

            # Heuristic 1: Plate cannot be far above the rider's chest
            if pcy < (ry1 + 0.35 * rh):
                continue

            # Heuristic 2: Horizontal alignment
            # The plate center should be within reasonable horizontal deviation of rider center
            dx = abs(pcx - rcx) / rw
            if dx > 1.2:  # Plate is horizontally too far from rider column
                continue

            # Heuristic 3: Vertical proximity (plate below rider base or lower torso)
            # Distance from rider bottom to plate center
            dy = (pcy - ry2) / rh
            # If plate is within lower torso or up to 1.5 rider heights below
            if dy < -0.6 or dy > 1.8:
                continue

            # Cost function: combination of horizontal alignment and vertical distance
            cost = math.sqrt((dx * 1.5) ** 2 + max(0.0, dy) ** 2)
            candidate_costs.append((cost, r_idx, r_data))

        # Sort candidate riders by cost
        candidate_costs.sort(key=lambda x: x[0])

        if not candidate_costs:
            # Number plate detected without identifiable associated rider
            records.append({
                "plate_info": plate_info,
                "associated_rider": None,
                "association_status": "no_rider",
                "association_confidence": 0.0,
                "helmet_status": "not_assessed",
                "helmet_confidence": 0.0,
                "violation_candidate": False,
                "review_required": plate_info["review_required"],
                "rider_bbox": None,
                "helmet_bbox": None,
                "notes": "Number plate detected without an identifiable rider in spatial proximity.",
            })
            continue

        best_cost, best_r_idx, best_r_data = candidate_costs[0]

        # Check for ambiguity: if another candidate has very similar cost
        is_ambiguous = False
        if len(candidate_costs) > 1:
            second_cost = candidate_costs[1][0]
            relative_diff = (second_cost - best_cost) / max(best_cost, 0.2)
            absolute_diff = second_cost - best_cost
            # Ambiguous if second candidate is in close competition for the plate
            if absolute_diff < 0.35 or relative_diff < 0.70:
                is_ambiguous = True

        if is_ambiguous:
            # Ambiguous association: multiple riders in proximity
            records.append({
                "plate_info": plate_info,
                "associated_rider": best_r_data,
                "association_status": "uncertain",
                "association_confidence": round(max(0.2, 1.0 - best_cost), 3),
                "helmet_status": best_r_data["helmet_status"],
                "helmet_confidence": best_r_data["helmet_confidence"],
                "violation_candidate": False,  # Strict: never flag violation if association is uncertain
                "review_required": True,
                "rider_bbox": best_r_data["rider"]["bbox"],
                "helmet_bbox": best_r_data["helmet_bbox"],
                "notes": "Multiple riders detected near number plate; association is ambiguous.",
            })
            used_rider_indices.add(best_r_idx)
        else:
            # Reliable association established
            used_rider_indices.add(best_r_idx)
            helmet_status = best_r_data["helmet_status"]
            helmet_conf = best_r_data["helmet_confidence"]
            ocr_status = plate_info["ocr_status"]

            # Violation candidate rule:
            # 1. Associated rider must have verified no_helmet detection with sufficient confidence (>= 0.20)
            # 2. Association must be reliable (not uncertain)
            # 3. Plate must be readable or plausibly unvalidated
            is_violation = (
                helmet_status == "no_helmet_detected"
                and helmet_conf >= 0.20
                and ocr_status in ("recognized", "unvalidated")
            )

            review_required = (
                plate_info["review_required"]
                or helmet_status == "uncertain"
                or helmet_conf < 0.20
                or is_violation  # Violations always require human review before action
                or best_cost > 0.8
            )

            records.append({
                "plate_info": plate_info,
                "associated_rider": best_r_data,
                "association_status": "associated",
                "association_confidence": round(max(0.4, min(0.98, 1.0 - (best_cost * 0.4))), 3),
                "helmet_status": helmet_status,
                "helmet_confidence": helmet_conf,
                "violation_candidate": is_violation,
                "review_required": review_required,
                "rider_bbox": best_r_data["rider"]["bbox"],
                "helmet_bbox": best_r_data["helmet_bbox"],
                "notes": "Rider and number plate successfully associated by spatial geometry.",
            })

    # Also handle riders who do NOT have any visible number plate in the image
    for r_idx, r_data in enumerate(associated_riders):
        if r_idx not in used_rider_indices:
            # Unassociated rider (e.g. rear-only plate missing or front-facing rider)
            records.append({
                "plate_info": {
                    "registration_number": None,
                    "ocr_status": "no_plate",
                    "ocr_confidence": 0.0,
                    "raw_ocr_text": "",
                    "plate_bbox": None,
                    "crop_base64": "",
                    "validation_format": "no_plate",
                    "review_required": False,
                    "notes": "Rider detected, but no visible number plate found.",
                },
                "associated_rider": r_data,
                "association_status": "no_plate",
                "association_confidence": 0.0,
                "helmet_status": r_data["helmet_status"],
                "helmet_confidence": r_data["helmet_confidence"],
                "violation_candidate": False,  # Cannot issue vehicle record without plate
                "review_required": r_data["helmet_status"] == "no_helmet_detected",
                "rider_bbox": r_data["rider"]["bbox"],
                "helmet_bbox": r_data["helmet_bbox"],
                "notes": "Rider visible without a detectable number plate.",
            })

    return records


def build_compliance_records(
    detections: List[Dict[str, Any]],
    ocr_plate_results: List[Dict[str, Any]],
    img_width: int,
    img_height: int
) -> List[Dict[str, Any]]:
    """
    Main orchestration function for association:
    1. Separates detections into riders, headwear (helmet / no_helmet), and plates.
    2. Runs helmet-to-rider association.
    3. Runs rider-to-plate association.
    4. Returns consolidated compliance records.
    """
    riders = [d for d in detections if d["class_name"] in ("rider", "pillion")]
    headwear = [d for d in detections if d["class_name"] in ("helmet", "no_helmet")]

    # Step 1: Associate helmets with riders
    associated_riders = associate_helmets_to_riders(riders, headwear)

    # Step 2: Associate plates with riders
    records = associate_plates_to_riders(ocr_plate_results, associated_riders, img_width, img_height)

    return records
