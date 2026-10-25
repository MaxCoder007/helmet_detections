"""
Unit tests for class-aware duplicate detection suppression and test cases 1-7.
"""

import unittest
from backend.duplicate_suppressor import (
    compute_box_metrics,
    suppress_class_duplicates,
)
from backend.conflict_resolver import resolve_helmet_conflicts


class TestDuplicateSuppressor(unittest.TestCase):
    def test_compute_box_metrics(self):
        # Box A: [100, 100, 200, 200] (area: 10000)
        # Box B: [150, 100, 250, 200] (area: 10000, inter: 50x100 = 5000, union: 15000)
        iou, containment = compute_box_metrics([100, 100, 200, 200], [150, 100, 250, 200])
        self.assertAlmostEqual(iou, 5000 / 15000, places=3)
        self.assertAlmostEqual(containment, 5000 / 10000, places=3)

        # Complete containment: Box B inside Box A
        # Box A: [100, 100, 300, 300] (area: 40000)
        # Box B: [150, 150, 250, 250] (area: 10000, inter: 10000)
        iou, containment = compute_box_metrics([100, 100, 300, 300], [150, 150, 250, 250])
        self.assertAlmostEqual(iou, 10000 / 40000, places=3)
        self.assertAlmostEqual(containment, 1.0, places=3)

    def test_case_1_single_motorcycle_single_plate_eliminates_duplicates(self):
        """Test Case 1: One motorcycle with one number plate should not generate duplicate plate boxes."""
        detections = [
            {"id": "det_p1", "class_name": "number_plate", "confidence": 0.85, "bbox": [185.0, 410.0, 290.0, 450.0]},
            # Slightly shifted lower-confidence duplicate with IoU ~ 0.65
            {"id": "det_p2", "class_name": "number_plate", "confidence": 0.35, "bbox": [182.0, 405.0, 295.0, 455.0]},
            # Looser candidate box containing the plate with Containment = 1.0
            {"id": "det_p3", "class_name": "number_plate", "confidence": 0.05, "bbox": [170.0, 390.0, 310.0, 470.0]},
        ]
        retained, suppressed = suppress_class_duplicates(detections)
        self.assertEqual(len(retained), 1)
        self.assertEqual(retained[0]["id"], "det_p1")
        self.assertEqual(len(suppressed), 2)

    def test_case_2_two_distinct_motorcycles_retain_both_plates(self):
        """Test Case 2: Two motorcycles with two distinct number plates should retain both plates."""
        detections = [
            {"id": "plate_left", "class_name": "number_plate", "confidence": 0.88, "bbox": [150.0, 400.0, 250.0, 450.0]},
            {"id": "plate_right", "class_name": "number_plate", "confidence": 0.72, "bbox": [550.0, 400.0, 650.0, 450.0]},
        ]
        retained, suppressed = suppress_class_duplicates(detections)
        self.assertEqual(len(retained), 2)
        self.assertEqual(len(suppressed), 0)
        retained_ids = {d["id"] for d in retained}
        self.assertIn("plate_left", retained_ids)
        self.assertIn("plate_right", retained_ids)

    def test_case_3_two_riders_remain_separate_detections(self):
        """Test Case 3: Two riders should remain two separate rider detections."""
        detections = [
            {"id": "rider_1", "class_name": "rider", "confidence": 0.80, "bbox": [100.0, 150.0, 300.0, 500.0]},
            {"id": "rider_2", "class_name": "rider", "confidence": 0.02, "bbox": [500.0, 150.0, 700.0, 500.0]},
        ]
        retained, suppressed = suppress_class_duplicates(detections)
        self.assertEqual(len(retained), 2)
        self.assertEqual(len(suppressed), 0)

    def test_case_4_rider_and_number_plate_overlap_both_preserved(self):
        """Test Case 4: A rider and a number plate should both remain even if their boxes overlap."""
        detections = [
            # Rider covering large region [100, 100, 350, 550]
            {"id": "rider_main", "class_name": "rider", "confidence": 0.75, "bbox": [100.0, 100.0, 350.0, 550.0]},
            # Number plate physically located within the lower portion of the rider [180, 400, 280, 450]
            {"id": "plate_main", "class_name": "number_plate", "confidence": 0.90, "bbox": [180.0, 400.0, 280.0, 450.0]},
        ]
        retained, suppressed = suppress_class_duplicates(detections)
        self.assertEqual(len(retained), 2)
        self.assertEqual(len(suppressed), 0)
        classes = {d["class_name"] for d in retained}
        self.assertEqual(classes, {"rider", "number_plate"})

    def test_case_5_helmet_conflict_resolution_opposing_headwear(self):
        """Test Case 5: A helmet and no_helmet conflict for the same head region should be resolved."""
        head_box = [370.0, 50.0, 430.0, 160.0]
        detections = [
            {"id": "head_no_helmet", "class_name": "no_helmet", "confidence": 0.65, "bbox": head_box},
            {"id": "head_helmet", "class_name": "helmet", "confidence": 0.15, "bbox": [372.0, 52.0, 428.0, 158.0]},
        ]
        # Opposing headwear is NOT suppressed by same-class duplicate suppression
        after_dup, dup_supp = suppress_class_duplicates(detections)
        self.assertEqual(len(after_dup), 2)
        self.assertEqual(len(dup_supp), 0)

        # It IS resolved by helmet conflict resolution
        final_dets, conflicts = resolve_helmet_conflicts(after_dup, conflict_iou_threshold=0.50)
        self.assertEqual(len(final_dets), 1)
        self.assertEqual(final_dets[0]["id"], "head_no_helmet")
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["suppressed"]["id"], "head_helmet")

    def test_case_6_separate_helmeted_and_unhelmeted_riders_not_merged(self):
        """Test Case 6: Separate helmeted and unhelmeted riders should not be incorrectly merged."""
        detections = [
            {"id": "head_rider1", "class_name": "helmet", "confidence": 0.85, "bbox": [150.0, 80.0, 210.0, 160.0]},
            {"id": "head_rider2", "class_name": "no_helmet", "confidence": 0.80, "bbox": [550.0, 80.0, 610.0, 160.0]},
        ]
        after_dup, _ = suppress_class_duplicates(detections)
        final_dets, conflicts = resolve_helmet_conflicts(after_dup, conflict_iou_threshold=0.50)
        self.assertEqual(len(final_dets), 2)
        self.assertEqual(len(conflicts), 0)

    def test_case_7_low_confidence_non_duplicates_preserved(self):
        """Test Case 7: Low-confidence predictions that are not duplicates should remain visible."""
        detections = [
            {"id": "high_conf_plate", "class_name": "number_plate", "confidence": 0.95, "bbox": [150.0, 400.0, 250.0, 450.0]},
            # Distant low-confidence plate with conf = 0.0015 (0.15%) at different coordinates
            {"id": "low_conf_plate", "class_name": "number_plate", "confidence": 0.0015, "bbox": [550.0, 250.0, 590.0, 275.0]},
            # Low-confidence rider with conf = 0.0014 (0.14%)
            {"id": "low_conf_rider", "class_name": "rider", "confidence": 0.0014, "bbox": [700.0, 200.0, 800.0, 450.0]},
        ]
        retained, suppressed = suppress_class_duplicates(detections)
        self.assertEqual(len(retained), 3)
        self.assertEqual(len(suppressed), 0)


if __name__ == "__main__":
    unittest.main()
