import unittest
from backend.quality_classifier import compute_box_geometry, classify_detection_quality

class TestQualityClassifier(unittest.TestCase):
    def test_geometry_computation(self):
        bbox = [100.0, 200.0, 200.0, 250.0]
        geo = compute_box_geometry(bbox, img_w=1000, img_h=1000)
        self.assertEqual(geo["width"], 100.0)
        self.assertEqual(geo["height"], 50.0)
        self.assertEqual(geo["area"], 5000.0)
        self.assertEqual(geo["aspect_ratio"], 2.0)
        self.assertEqual(geo["area_pct"], 0.5)

    def test_oversized_number_plate_flagged(self):
        # A box like [0, 0, 300, 285] on a 640x640 image covers 20.9% of image area and 44% of image height
        detections = [
            {
                "id": "det_oversized",
                "class_id": 2,
                "class_name": "number_plate",
                "confidence": 0.0615,
                "bbox": [0.0, 0.0, 300.0, 285.0],
            }
        ]
        results = classify_detection_quality(detections, image_width=640, image_height=640)
        self.assertEqual(len(results), 1)
        item = results[0]
        self.assertEqual(item["quality_status"], "suspicious_geometry")
        self.assertTrue(item["is_suspicious"])
        self.assertTrue(any("Oversized number plate" in w for w in item["quality_warnings"]))

    def test_valid_plate_high_confidence(self):
        detections = [
            {
                "id": "det_normal_plate",
                "class_id": 2,
                "class_name": "number_plate",
                "confidence": 0.8304,
                "bbox": [185.6, 411.4, 288.5, 450.3],
            }
        ]
        results = classify_detection_quality(detections, image_width=640, image_height=640)
        self.assertEqual(results[0]["quality_status"], "high_confidence")
        self.assertFalse(results[0]["is_suspicious"])
        self.assertEqual(len(results[0]["quality_warnings"]), 0)

    def test_low_confidence_valid_geometry(self):
        detections = [
            {
                "id": "det_low_conf",
                "class_id": 4,
                "class_name": "rider",
                "confidence": 0.0146,
                "bbox": [0.0, 15.3, 298.0, 322.8],
            }
        ]
        results = classify_detection_quality(detections, image_width=640, image_height=640)
        self.assertEqual(results[0]["quality_status"], "low_confidence")
        self.assertFalse(results[0]["is_suspicious"])
        self.assertTrue(any("Low confidence prediction" in w for w in results[0]["quality_warnings"]))

    def test_abnormal_aspect_ratio_plate(self):
        # Vertically tall number plate box (e.g. W=30, H=90 -> aspect_ratio = 0.33)
        detections = [
            {
                "id": "det_tall_plate",
                "class_id": 2,
                "class_name": "number_plate",
                "confidence": 0.40,
                "bbox": [100.0, 100.0, 130.0, 190.0],
            }
        ]
        results = classify_detection_quality(detections, image_width=640, image_height=640)
        self.assertEqual(results[0]["quality_status"], "suspicious_geometry")
        self.assertTrue(any("Abnormal plate aspect ratio" in w for w in results[0]["quality_warnings"]))


if __name__ == "__main__":
    unittest.main()
