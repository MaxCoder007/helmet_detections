import unittest
import numpy as np
from backend.conflict_resolver import (
    compute_box_iou,
    resolve_helmet_conflicts,
    draw_annotated_detections
)

class TestConflictResolution(unittest.TestCase):

    def test_case_1_high_confidence_helmet(self):
        # 1. A high-confidence helmet prediction
        dets = [
            {"id": "d1", "class_id": 0, "class_name": "helmet", "confidence": 0.94, "bbox": [100, 50, 160, 110]}
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["class_name"], "helmet")
        self.assertEqual(len(conflicts), 0)

    def test_case_2_high_confidence_no_helmet(self):
        # 2. A high-confidence no-helmet prediction
        dets = [
            {"id": "d1", "class_id": 1, "class_name": "no_helmet", "confidence": 0.91, "bbox": [100, 50, 160, 110]}
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["class_name"], "no_helmet")
        self.assertEqual(len(conflicts), 0)

    def test_case_3_overlapping_helmet_wins(self):
        # 3. Overlapping helmet and no-helmet predictions where helmet has the higher score
        dets = [
            {"id": "d_helmet", "class_id": 0, "class_name": "helmet", "confidence": 0.88, "bbox": [100, 50, 160, 110]},
            {"id": "d_no_helmet", "class_id": 1, "class_name": "no_helmet", "confidence": 0.42, "bbox": [105, 52, 162, 112]}
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["class_name"], "helmet")
        self.assertEqual(filtered[0]["confidence"], 0.88)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["retained"]["class_name"], "helmet")
        self.assertEqual(conflicts[0]["suppressed"]["class_name"], "no_helmet")

    def test_case_4_overlapping_no_helmet_wins(self):
        # 4. Overlapping predictions where no-helmet has the higher score
        dets = [
            {"id": "d_helmet", "class_id": 0, "class_name": "helmet", "confidence": 0.31, "bbox": [100, 50, 160, 110]},
            {"id": "d_no_helmet", "class_id": 1, "class_name": "no_helmet", "confidence": 0.86, "bbox": [102, 50, 158, 108]}
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["class_name"], "no_helmet")
        self.assertEqual(filtered[0]["confidence"], 0.86)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["retained"]["class_name"], "no_helmet")
        self.assertEqual(conflicts[0]["suppressed"]["class_name"], "helmet")

    def test_case_5_non_overlapping_both_preserved(self):
        # 5. Non-overlapping helmet and no-helmet predictions that should both be preserved
        dets = [
            {"id": "d_helmet", "class_id": 0, "class_name": "helmet", "confidence": 0.85, "bbox": [50, 50, 110, 110]},
            {"id": "d_no_helmet", "class_id": 1, "class_name": "no_helmet", "confidence": 0.82, "bbox": [300, 50, 360, 110]}
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 2)
        classes = {d["class_name"] for d in filtered}
        self.assertEqual(classes, {"helmet", "no_helmet"})
        self.assertEqual(len(conflicts), 0)

    def test_case_6_unrelated_classes_intact(self):
        # 6. Predictions for rider, pillion, and number_plate that should remain intact
        dets = [
            {"id": "d_rider", "class_id": 4, "class_name": "rider", "confidence": 0.90, "bbox": [100, 50, 200, 300]},
            {"id": "d_pillion", "class_id": 3, "class_name": "pillion", "confidence": 0.78, "bbox": [200, 80, 280, 280]},
            {"id": "d_plate", "class_id": 2, "class_name": "number_plate", "confidence": 0.92, "bbox": [130, 280, 170, 310]},
            {"id": "d_helmet", "class_id": 0, "class_name": "helmet", "confidence": 0.89, "bbox": [120, 50, 160, 100]},
            {"id": "d_no_helmet", "class_id": 1, "class_name": "no_helmet", "confidence": 0.40, "bbox": [122, 52, 160, 102]},
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        # Expect 4 items: rider, pillion, plate, and winning helmet (no_helmet eliminated)
        self.assertEqual(len(filtered), 4)
        cnames = [d["class_name"] for d in filtered]
        self.assertIn("rider", cnames)
        self.assertIn("pillion", cnames)
        self.assertIn("number_plate", cnames)
        self.assertIn("helmet", cnames)
        self.assertNotIn("no_helmet", cnames)
        self.assertEqual(len(conflicts), 1)

    def test_case_7_empty_predictions(self):
        # 7. Empty prediction results
        filtered, conflicts = resolve_helmet_conflicts([], conflict_iou_threshold=0.50)
        self.assertEqual(filtered, [])
        self.assertEqual(conflicts, [])

    def test_case_8_very_low_confidence_preserved(self):
        # 8. Very low-confidence predictions (e.g. conf=0.001) are preserved if no conflict
        dets = [
            {"id": "d_low", "class_id": 0, "class_name": "helmet", "confidence": 0.0012, "bbox": [100, 50, 160, 110]},
            {"id": "d_plate", "class_id": 2, "class_name": "number_plate", "confidence": 0.0035, "bbox": [110, 200, 150, 220]},
        ]
        filtered, conflicts = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 2)
        self.assertEqual(filtered[0]["confidence"], 0.0035)
        self.assertEqual(filtered[1]["confidence"], 0.0012)

    def test_case_9_annotated_image_consistency(self):
        # 10. Consistency between API detections and the annotated image
        img = np.zeros((400, 400, 3), dtype=np.uint8)
        dets = [
            {"id": "d1", "class_id": 0, "class_name": "helmet", "confidence": 0.88, "bbox": [50, 50, 100, 100]},
            {"id": "d2", "class_id": 1, "class_name": "no_helmet", "confidence": 0.20, "bbox": [52, 52, 98, 98]},
        ]
        filtered, _ = resolve_helmet_conflicts(dets, conflict_iou_threshold=0.50)
        self.assertEqual(len(filtered), 1)

        # Draw only filtered
        annotated = draw_annotated_detections(img, filtered, low_conf_threshold=0.25)
        self.assertEqual(annotated.shape, img.shape)
        # Ensure image has non-zero pixels drawn
        self.assertTrue(np.any(annotated > 0))

if __name__ == "__main__":
    unittest.main()
