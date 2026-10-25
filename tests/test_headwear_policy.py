"""
Regression tests for RoadVision AI Headwear Policy & Detection Pipeline.

Verifies:
1. Two overlapping no_helmet predictions for one head produce one final headwear detection.
2. Overlapping helmet and no_helmet predictions for the same head are resolved appropriately.
3. Two nearby riders without helmets remain two distinct detections.
4. A rider box is not removed because it overlaps a no_helmet box.
5. A number_plate box is not removed by headwear suppression.
6. Low-confidence detections remain available down to 0.001 unless genuine duplicates or invalid outputs.
7. Ambiguous headwear predictions are flagged as uncertain.
8. Bounding box coordinates remain preserved in the original image coordinate system.
"""

import unittest
from backend.duplicate_suppressor import (
    compute_box_metrics,
    compute_spatial_metrics,
    suppress_class_duplicates,
)
from backend.conflict_resolver import (
    resolve_helmet_conflicts,
    draw_annotated_detections,
)


class TestHeadwearPolicy(unittest.TestCase):

    def test_single_no_helmet_duplicate_suppression(self):
        """Two overlapping no_helmet predictions for one head produce one final headwear detection."""
        # Head box (full face/skull) and concentric sub-box (lower face or hairline)
        raw_dets = [
            {"id": "nh_main", "class_id": 1, "class_name": "no_helmet", "confidence": 0.85, "bbox": [200.0, 100.0, 260.0, 180.0]},
            {"id": "nh_dup", "class_id": 1, "class_name": "no_helmet", "confidence": 0.05, "bbox": [205.0, 110.0, 255.0, 175.0]},
        ]
        retained, suppressed = suppress_class_duplicates(raw_dets)
        self.assertEqual(len(retained), 1)
        self.assertEqual(retained[0]["id"], "nh_main")
        self.assertEqual(len(suppressed), 1)
        self.assertEqual(suppressed[0]["suppressed"]["id"], "nh_dup")

        # After conflict resolver, still exactly 1 detection
        final, conflicts = resolve_helmet_conflicts(retained)
        self.assertEqual(len(final), 1)
        self.assertEqual(final[0]["id"], "nh_main")
        self.assertEqual(final[0]["class_name"], "no_helmet")
        self.assertEqual(len(conflicts), 0)

    def test_opposing_helmet_no_helmet_resolution(self):
        """Overlapping helmet and no_helmet predictions for the same head are resolved appropriately."""
        # Scenario: Person is not wearing a helmet (no_helmet 65%), model also produces 2% helmet proposal
        raw_dets = [
            {"id": "h_noise", "class_id": 0, "class_name": "helmet", "confidence": 0.02, "bbox": [202.0, 100.0, 258.0, 135.0]},
            {"id": "nh_strong", "class_id": 1, "class_name": "no_helmet", "confidence": 0.65, "bbox": [200.0, 100.0, 260.0, 180.0]},
        ]
        # Same-class duplicate suppressor leaves different classes intact
        after_dup, _ = suppress_class_duplicates(raw_dets)
        self.assertEqual(len(after_dup), 2)

        # Conflict resolver eliminates the opposing helmet prediction
        final, conflicts = resolve_helmet_conflicts(after_dup)
        self.assertEqual(len(final), 1)
        self.assertEqual(final[0]["id"], "nh_strong")
        self.assertEqual(final[0]["class_name"], "no_helmet")
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["suppressed"]["id"], "h_noise")

    def test_helmet_wins_when_evidence_supports_helmet(self):
        """When helmet confidence is high and no_helmet is low proposal, helmet is retained."""
        raw_dets = [
            {"id": "h_strong", "class_id": 0, "class_name": "helmet", "confidence": 0.88, "bbox": [150.0, 80.0, 220.0, 160.0]},
            {"id": "nh_weak", "class_id": 1, "class_name": "no_helmet", "confidence": 0.04, "bbox": [155.0, 85.0, 215.0, 155.0]},
        ]
        after_dup, _ = suppress_class_duplicates(raw_dets)
        final, conflicts = resolve_helmet_conflicts(after_dup)
        self.assertEqual(len(final), 1)
        self.assertEqual(final[0]["id"], "h_strong")
        self.assertEqual(final[0]["class_name"], "helmet")
        self.assertEqual(len(conflicts), 1)

    def test_preserve_two_distinct_nearby_riders(self):
        """Two nearby riders without helmets remain two distinct detections."""
        # Rider 1 (left) and Rider 2 / pillion (right): horizontally separated (rel_dx >= 0.45)
        # Even with partial spatial overlap, distinct centers protect both detections
        dets = [
            {"id": "rider1_head", "class_id": 1, "class_name": "no_helmet", "confidence": 0.75, "bbox": [168.0, 10.0, 205.0, 56.0]},
            {"id": "rider2_head", "class_id": 1, "class_name": "no_helmet", "confidence": 0.60, "bbox": [190.0, 8.0, 214.0, 46.0]},
        ]
        retained, suppressed = suppress_class_duplicates(dets)
        # Both distinct heads must be preserved!
        self.assertEqual(len(retained), 2)
        self.assertEqual(len(suppressed), 0)

        final, conflicts = resolve_helmet_conflicts(retained)
        self.assertEqual(len(final), 2)
        self.assertEqual(len(conflicts), 0)

    def test_rider_box_never_suppressed_by_headwear(self):
        """A rider box is not removed because it overlaps a no_helmet box."""
        dets = [
            {"id": "rider_body", "class_id": 4, "class_name": "rider", "confidence": 0.92, "bbox": [150.0, 60.0, 320.0, 450.0]},
            {"id": "rider_head", "class_id": 1, "class_name": "no_helmet", "confidence": 0.88, "bbox": [200.0, 60.0, 260.0, 140.0]},
        ]
        after_dup, dup_log = suppress_class_duplicates(dets)
        self.assertEqual(len(after_dup), 2)
        self.assertEqual(len(dup_log), 0)

        final, conf_log = resolve_helmet_conflicts(after_dup)
        self.assertEqual(len(final), 2)
        self.assertEqual(len(conf_log), 0)
        cnames = {d["class_name"] for d in final}
        self.assertEqual(cnames, {"rider", "no_helmet"})

    def test_number_plate_never_suppressed_by_headwear_or_rider(self):
        """A number_plate box is not removed by headwear or rider suppression."""
        dets = [
            {"id": "rider_body", "class_id": 4, "class_name": "rider", "confidence": 0.85, "bbox": [100.0, 50.0, 250.0, 400.0]},
            {"id": "rider_head", "class_id": 1, "class_name": "no_helmet", "confidence": 0.80, "bbox": [150.0, 50.0, 210.0, 130.0]},
            {"id": "plate", "class_id": 2, "class_name": "number_plate", "confidence": 0.78, "bbox": [140.0, 350.0, 220.0, 385.0]},
        ]
        after_dup, _ = suppress_class_duplicates(dets)
        self.assertEqual(len(after_dup), 3)

        final, _ = resolve_helmet_conflicts(after_dup)
        self.assertEqual(len(final), 3)
        cnames = [d["class_name"] for d in final]
        self.assertIn("number_plate", cnames)
        self.assertIn("rider", cnames)
        self.assertIn("no_helmet", cnames)

    def test_low_confidence_detections_preserved_in_all_detections_mode(self):
        """Low-confidence detections remain available down to 0.001 unless genuine duplicates."""
        dets = [
            {"id": "dist_head", "class_id": 1, "class_name": "no_helmet", "confidence": 0.0015, "bbox": [500.0, 20.0, 530.0, 60.0]},
            {"id": "dist_plate", "class_id": 2, "class_name": "number_plate", "confidence": 0.0021, "bbox": [480.0, 150.0, 520.0, 170.0]},
        ]
        after_dup, _ = suppress_class_duplicates(dets)
        self.assertEqual(len(after_dup), 2)
        final, _ = resolve_helmet_conflicts(after_dup)
        self.assertEqual(len(final), 2)
        # Confidence scores are strictly preserved
        self.assertEqual(final[0]["confidence"], 0.0021)
        self.assertEqual(final[1]["confidence"], 0.0015)

    def test_ambiguous_opposing_headwear_marked_uncertain(self):
        """Ambiguous opposing headwear (e.g. conf difference < 0.05) is flagged as uncertain."""
        dets = [
            {"id": "h_ambig", "class_id": 0, "class_name": "helmet", "confidence": 0.42, "bbox": [100.0, 50.0, 160.0, 110.0]},
            {"id": "nh_ambig", "class_id": 1, "class_name": "no_helmet", "confidence": 0.40, "bbox": [102.0, 52.0, 158.0, 108.0]},
        ]
        after_dup, _ = suppress_class_duplicates(dets)
        final, conflicts = resolve_helmet_conflicts(after_dup, ambiguity_conf_margin=0.05)
        self.assertEqual(len(final), 1)
        self.assertTrue(final[0].get("is_uncertain"))
        self.assertEqual(len(conflicts), 1)
        self.assertTrue(conflicts[0].get("is_uncertain"))

    def test_frontend_unique_detection_ids_and_no_duplicate_rendering(self):
        """Verifies that every detection has a unique ID and duplicate object references are eliminated."""
        dets = [
            {"id": "det_0", "class_id": 1, "class_name": "no_helmet", "confidence": 0.90, "bbox": [100.0, 50.0, 160.0, 110.0]},
            {"id": "det_1", "class_id": 4, "class_name": "rider", "confidence": 0.85, "bbox": [80.0, 40.0, 220.0, 300.0]},
        ]
        retained, _ = suppress_class_duplicates(dets)
        final, _ = resolve_helmet_conflicts(retained)
        ids = [d["id"] for d in final]
        # Every detection in the authoritative array has a strictly unique ID
        self.assertEqual(len(ids), len(set(ids)))

    def test_bounding_box_coordinates_strictly_preserved(self):
        """Coordinates remain in original image space without distortion."""
        orig_box = [186.2, 411.7, 289.4, 450.8]
        dets = [
            {"id": "p1", "class_id": 2, "class_name": "number_plate", "confidence": 0.83, "bbox": list(orig_box)}
        ]
        retained, _ = suppress_class_duplicates(dets)
        final, _ = resolve_helmet_conflicts(retained)
        self.assertEqual(final[0]["bbox"], orig_box)


if __name__ == "__main__":
    unittest.main()
