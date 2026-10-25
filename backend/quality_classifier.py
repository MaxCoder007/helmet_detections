"""
Detection Quality Classification and Bounding Box Geometry Sanity Validation for RoadVision AI.

Analyzes retained YOLO predictions to flag:
1. High Confidence: Reliable detection (conf >= 0.25) with physically plausible geometry.
2. Low Confidence: Predictions with conf < 0.25 that pass geometric sanity checks.
3. Suspicious Geometry: Oversized boxes (e.g. number plate covering > 8% of image area,
   vertical aspect ratio < 0.65, or plate height > 20% of image height).
4. Potential Duplicate: Detections with borderline overlap with another same-class candidate.
"""

from typing import List, Dict, Any, Tuple


def compute_box_geometry(bbox: List[float], img_w: int, img_h: int) -> Dict[str, float]:
    """Calculates geometric properties for a bounding box [x1, y1, x2, y2]."""
    x1, y1, x2, y2 = bbox
    w = max(1.0, float(x2 - x1))
    h = max(1.0, float(y2 - y1))
    area = w * h
    img_area = max(1.0, float(img_w * img_h))

    return {
        "width": round(w, 1),
        "height": round(h, 1),
        "area": round(area, 1),
        "aspect_ratio": round(w / h, 2),
        "area_pct": round((area / img_area) * 100, 2),
        "height_pct": round((h / max(1.0, img_h)) * 100, 2),
        "width_pct": round((w / max(1.0, img_w)) * 100, 2),
    }


def classify_detection_quality(
    detections: List[Dict[str, Any]],
    image_width: int,
    image_height: int,
    confidence_threshold_normal: float = 0.25,
    max_plate_area_pct: float = 8.0,
    max_plate_height_pct: float = 20.0,
    min_plate_aspect_ratio: float = 0.65,
    max_plate_aspect_ratio: float = 7.0,
) -> List[Dict[str, Any]]:
    """
    Annotates each detection with an objective quality_status and human-readable warnings.
    Does NOT alter model confidence scores.
    """
    if not detections:
        return []

    validated_detections = []

    for i, d in enumerate(detections):
        cls = d.get("class_name", "")
        conf = float(d.get("confidence", 0.0))
        bbox = d.get("bbox", [0, 0, 0, 0])
        geo = compute_box_geometry(bbox, image_width, image_height)

        warnings = []
        is_suspicious_geo = False
        is_potential_dup = False

        # 1. Bounding Box Geometry Sanity Checks
        if cls == "number_plate":
            if geo["area_pct"] > max_plate_area_pct or geo["height_pct"] > max_plate_height_pct:
                is_suspicious_geo = True
                warnings.append(
                    f"Oversized number plate: occupies {geo['area_pct']}% of image ({geo['width']}×{geo['height']}px, "
                    f"{geo['height_pct']}% img height). Likely vehicle body or rider false positive."
                )
            if geo["aspect_ratio"] < min_plate_aspect_ratio:
                is_suspicious_geo = True
                warnings.append(
                    f"Abnormal plate aspect ratio (W/H={geo['aspect_ratio']} < {min_plate_aspect_ratio}: vertically tall box)."
                )
            elif geo["aspect_ratio"] > max_plate_aspect_ratio:
                is_suspicious_geo = True
                warnings.append(
                    f"Abnormal plate aspect ratio (W/H={geo['aspect_ratio']} > {max_plate_aspect_ratio}: extreme sliver)."
                )
        elif cls in ("helmet", "no_helmet"):
            if geo["area_pct"] > 25.0:
                is_suspicious_geo = True
                warnings.append(
                    f"Oversized headwear: occupies {geo['area_pct']}% of image ({geo['width']}×{geo['height']}px)."
                )
            if geo["aspect_ratio"] < 0.35 or geo["aspect_ratio"] > 3.0:
                is_suspicious_geo = True
                warnings.append(
                    f"Abnormal headwear aspect ratio (W/H={geo['aspect_ratio']})."
                )
        elif cls in ("rider", "pillion"):
            if geo["aspect_ratio"] > 3.5:
                is_suspicious_geo = True
                warnings.append(
                    f"Abnormal rider aspect ratio (W/H={geo['aspect_ratio']}: horizontally stretched)."
                )

        # 2. Check for borderline duplicate proximity with another retained box of same class
        for j, other in enumerate(detections):
            if i == j or cls != other.get("class_name"):
                continue
            other_box = other.get("bbox", [0, 0, 0, 0])
            xA = max(bbox[0], other_box[0])
            yA = max(bbox[1], other_box[1])
            xB = min(bbox[2], other_box[2])
            yB = min(bbox[3], other_box[3])
            iw = max(0.0, xB - xA)
            ih = max(0.0, yB - yA)
            ia = iw * ih
            if ia > 0:
                union = geo["area"] + max(1.0, (other_box[2] - other_box[0]) * (other_box[3] - other_box[1])) - ia
                iou = ia / union if union > 0 else 0.0
                containment = ia / min(geo["area"], (other_box[2] - other_box[0]) * (other_box[3] - other_box[1]))
                if 0.25 <= iou < 0.35 or 0.35 <= containment < 0.50:
                    is_potential_dup = True
                    other_id = other.get("id", f"det_{j}")
                    warnings.append(
                        f"Potential borderline duplicate with {other_id} (IoU={iou:.2f}, Containment={containment:.2f})."
                    )

        # 3. Assign Objective Quality Classification
        if is_suspicious_geo:
            status = "suspicious_geometry"
        elif is_potential_dup:
            status = "potential_duplicate"
        elif conf >= confidence_threshold_normal:
            status = "high_confidence"
        else:
            status = "low_confidence"
            warnings.append(f"Low confidence prediction ({conf * 100:.2f}%): verify visually.")

        # Create enriched copy
        enriched = dict(d)
        enriched["quality_status"] = status
        enriched["quality_warnings"] = warnings
        enriched["is_suspicious"] = is_suspicious_geo or is_potential_dup
        enriched["geometry"] = geo
        validated_detections.append(enriched)

    return validated_detections
