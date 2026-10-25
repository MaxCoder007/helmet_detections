import unittest
from backend.association import build_compliance_records

class TestAssociation(unittest.TestCase):
    def test_single_motorcycle_violation(self):
        # Rider with no_helmet and clear plate
        detections = [
            {'class_id': 4, 'class_name': 'rider', 'confidence': 0.88, 'bbox': [100, 100, 200, 350]},
            {'class_id': 1, 'class_name': 'no_helmet', 'confidence': 0.92, 'bbox': [120, 100, 180, 160]},
            {'class_id': 2, 'class_name': 'number_plate', 'confidence': 0.85, 'bbox': [130, 360, 180, 390]},
        ]
        plate_ocr = [{
            'registration_number': 'KA01AB1234',
            'ocr_status': 'recognized',
            'ocr_confidence': 0.95,
            'raw_ocr_text': 'KA01AB1234',
            'plate_bbox': [130, 360, 180, 390],
            'crop_base64': '',
            'validation_format': 'standard',
            'review_required': False,
            'notes': 'Test plate'
        }]

        records = build_compliance_records(detections, plate_ocr, 640, 480)
        self.assertEqual(len(records), 1)
        r = records[0]
        self.assertEqual(r['plate_info']['registration_number'], 'KA01AB1234')
        self.assertEqual(r['helmet_status'], 'no_helmet_detected')
        self.assertEqual(r['association_status'], 'associated')
        self.assertTrue(r['violation_candidate'])

    def test_compliant_helmet_rider(self):
        # Rider with helmet and clear plate
        detections = [
            {'class_id': 4, 'class_name': 'rider', 'confidence': 0.88, 'bbox': [100, 100, 200, 350]},
            {'class_id': 0, 'class_name': 'helmet', 'confidence': 0.94, 'bbox': [120, 100, 180, 160]},
            {'class_id': 2, 'class_name': 'number_plate', 'confidence': 0.85, 'bbox': [130, 360, 180, 390]},
        ]
        plate_ocr = [{
            'registration_number': 'MH12DE1433',
            'ocr_status': 'recognized',
            'ocr_confidence': 0.92,
            'raw_ocr_text': 'MH12DE1433',
            'plate_bbox': [130, 360, 180, 390],
            'crop_base64': '',
            'validation_format': 'standard',
            'review_required': False,
            'notes': 'Test plate'
        }]

        records = build_compliance_records(detections, plate_ocr, 640, 480)
        self.assertEqual(len(records), 1)
        r = records[0]
        self.assertEqual(r['plate_info']['registration_number'], 'MH12DE1433')
        self.assertEqual(r['helmet_status'], 'helmet_detected')
        self.assertEqual(r['association_status'], 'associated')
        self.assertFalse(r['violation_candidate'])

    def test_ambiguous_multiple_riders(self):
        # Two riders side by side equidistant to one plate
        detections = [
            {'class_id': 4, 'class_name': 'rider', 'confidence': 0.88, 'bbox': [100, 100, 200, 350]},
            {'class_id': 4, 'class_name': 'rider', 'confidence': 0.89, 'bbox': [180, 100, 280, 350]},
            {'class_id': 1, 'class_name': 'no_helmet', 'confidence': 0.90, 'bbox': [120, 100, 180, 160]},
            {'class_id': 0, 'class_name': 'helmet', 'confidence': 0.91, 'bbox': [200, 100, 260, 160]},
            {'class_id': 2, 'class_name': 'number_plate', 'confidence': 0.85, 'bbox': [180, 360, 220, 390]},
        ]
        plate_ocr = [{
            'registration_number': 'KA03CD5678',
            'ocr_status': 'recognized',
            'ocr_confidence': 0.90,
            'raw_ocr_text': 'KA03CD5678',
            'plate_bbox': [180, 360, 220, 390],
            'crop_base64': '',
            'validation_format': 'standard',
            'review_required': False,
            'notes': 'Test plate'
        }]

        records = build_compliance_records(detections, plate_ocr, 640, 480)
        plate_rec = [r for r in records if r['plate_info']['registration_number'] == 'KA03CD5678'][0]
        self.assertEqual(plate_rec['association_status'], 'uncertain')
        # Crucial requirement: Violation candidate MUST be false if association is uncertain!
        self.assertFalse(plate_rec['violation_candidate'])
        self.assertTrue(plate_rec['review_required'])

if __name__ == '__main__':
    unittest.main()
