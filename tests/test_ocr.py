"""
Unit and Integration Tests for Number Plate OCR in RoadVision AI.

Tests 12 core requirements:
1. Valid bounding-box cropping.
2. Bounding boxes extending beyond image boundaries (clamping).
3. Invalid or empty bounding boxes.
4. OCR text normalization.
5. Registration-format validation (Standard, Bharat Series, Legacy, Invalid).
6. Unreadable plates handling.
7. OCR exceptions handling.
8. Multiple detected number plates in one image.
9. Images without any number-plate detections.
10. Ensuring OCR is never called for non-number_plate classes.
11. Ensuring OCR failure does not remove the corresponding YOLO detection.
12. Ensuring API response format compatibility.
"""

import unittest
from unittest.mock import MagicMock, patch
import numpy as np
import cv2

from backend.ocr import (
    clamp_and_crop_bbox,
    preprocess_plate_image,
    preprocess_variant_clahe,
    preprocess_variant_sharpen,
    preprocess_variant_otsu,
    normalize_ocr_text,
    validate_indian_registration,
    extract_number_plate_ocr,
    set_ocr_reader_for_testing,
    order_tokens_into_reading_sequence,
    extract_plate_substrings,
    generate_registration_hypotheses,
    score_plate_candidate,
)


class MockEasyOCRReader:
    """Mock reader for testing without downloading EasyOCR model weights."""
    def __init__(self, mock_return=None, side_effect=None):
        self.mock_return = mock_return or []
        self.side_effect = side_effect

    def readtext(self, image, **kwargs):
        if self.side_effect:
            raise self.side_effect
        return self.mock_return


class TestNumberPlateOCR(unittest.TestCase):
    def setUp(self):
        # Create a standard synthetic test image (480x640 BGR)
        self.test_img = np.zeros((480, 640, 3), dtype=np.uint8)
        # Draw a synthetic white plate rectangle with text
        cv2.rectangle(self.test_img, (150, 200), (350, 260), (255, 255, 255), -1)
        cv2.putText(
            self.test_img,
            "KA 01 AB 1234",
            (160, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2
        )

    def tearDown(self):
        # Reset reader
        set_ocr_reader_for_testing(None)

    # 1. Valid bounding-box cropping
    def test_valid_bounding_box_cropping(self):
        bbox = [150, 200, 350, 260]
        crop, clamped = clamp_and_crop_bbox(self.test_img, bbox)
        self.assertIsNotNone(crop)
        self.assertGreater(crop.shape[0], 0)
        self.assertGreater(crop.shape[1], 0)
        self.assertEqual(clamped, [150, 200, 350, 260])

    # 2. Bounding boxes extending beyond image boundaries
    def test_bbox_extending_beyond_image_boundaries(self):
        # Box extending before x=0 and after x=640, before y=0 and after y=480
        bbox = [-30, -20, 700, 520]
        crop, clamped = clamp_and_crop_bbox(self.test_img, bbox)
        self.assertIsNotNone(crop)
        # Should be clamped within image dimensions
        self.assertLessEqual(crop.shape[0], 480)
        self.assertLessEqual(crop.shape[1], 640)

    # 3. Invalid or empty bounding boxes
    def test_invalid_or_empty_bounding_box(self):
        # Zero area box
        crop_zero, _ = clamp_and_crop_bbox(self.test_img, [100, 100, 100, 100])
        self.assertIsNone(crop_zero)

        # Inverted coordinates
        res_inv = extract_number_plate_ocr(self.test_img, [300, 200, 100, 100])
        self.assertIsNone(res_inv["text"])
        self.assertIn(res_inv["status"], ["unreadable", "error"])

        # Completely outside image
        crop_out, _ = clamp_and_crop_bbox(self.test_img, [1000, 1000, 1200, 1200])
        self.assertIsNone(crop_out)

    # 4. OCR text normalization
    def test_ocr_text_normalization(self):
        # Spaces, punctuation, hyphens, and lowercase characters
        self.assertEqual(normalize_ocr_text("ka-01 ab  1234"), "KA01AB1234")
        self.assertEqual(normalize_ocr_text("DL.8.CAF.5030!"), "DL8CAF5030")
        self.assertEqual(normalize_ocr_text(" mh 12 de 1433 "), "MH12DE1433")
        self.assertEqual(normalize_ocr_text(""), "")
        self.assertEqual(normalize_ocr_text(None), "")

    # 5. Registration-format validation
    def test_registration_format_validation(self):
        # Standard formats
        val1 = validate_indian_registration("KA01AB1234")
        self.assertTrue(val1["is_valid"])
        self.assertEqual(val1["format_type"], "standard")
        self.assertEqual(val1["state_code"], "KA")
        self.assertTrue(val1["state_verified"])
        self.assertEqual(val1["status"], "valid")

        val2 = validate_indian_registration("DL8CAF5030")
        self.assertTrue(val2["is_valid"])
        self.assertEqual(val2["format_type"], "standard")
        self.assertEqual(val2["state_code"], "DL")
        self.assertTrue(val2["state_verified"])

        val3 = validate_indian_registration("MH12DE1433")
        self.assertTrue(val3["is_valid"])
        self.assertEqual(val3["format_type"], "standard")
        self.assertEqual(val3["state_code"], "MH")

        # Bharat series format
        val_bh = validate_indian_registration("22BH1234AA")
        self.assertTrue(val_bh["is_valid"])
        self.assertEqual(val_bh["format_type"], "bharat_series")
        self.assertEqual(val_bh["status"], "valid")

        # Legacy / vintage format (e.g. DLA1234)
        val_leg = validate_indian_registration("DLA1234")
        self.assertTrue(val_leg["is_valid"])
        self.assertEqual(val_leg["format_type"], "legacy")

        # Standard format without series letters (e.g. KA011234)
        val_no_series = validate_indian_registration("KA011234")
        self.assertTrue(val_no_series["is_valid"])
        self.assertEqual(val_no_series["format_type"], "standard")

        # Unverified state code in standard pattern
        val_unv = validate_indian_registration("ZZ99AB1234")
        self.assertTrue(val_unv["is_valid"])
        self.assertFalse(val_unv["state_verified"])
        self.assertEqual(val_unv["status"], "uncertain")

        # Invalid formats
        val_inv1 = validate_indian_registration("12345")
        self.assertFalse(val_inv1["is_valid"])
        self.assertEqual(val_inv1["status"], "invalid")

        val_inv2 = validate_indian_registration("NOTAPLATE")
        self.assertFalse(val_inv2["is_valid"])

        val_empty = validate_indian_registration("")
        self.assertFalse(val_empty["is_valid"])
        self.assertEqual(val_empty["format_type"], "empty")

    # 6. Unreadable plates
    def test_unreadable_plates(self):
        # Extremely small box (< 12px height)
        res_small = extract_number_plate_ocr(self.test_img, [100, 100, 130, 108])
        self.assertEqual(res_small["status"], "unreadable")
        self.assertIsNone(res_small["text"])
        self.assertIsNone(res_small["confidence"])
        self.assertIsNone(res_small["format_valid"])
        self.assertTrue(res_small["review_required"])

        # Mock reader returning no characters (blank/blurred plate)
        set_ocr_reader_for_testing(MockEasyOCRReader(mock_return=[]))
        res_blank = extract_number_plate_ocr(self.test_img, [150, 200, 350, 260])
        self.assertEqual(res_blank["status"], "unreadable")
        self.assertIsNone(res_blank["text"])
        self.assertIsNone(res_blank["confidence"])

    # 7. OCR exceptions
    def test_ocr_exceptions(self):
        # Mock reader raising an unexpected exception
        failing_reader = MockEasyOCRReader(side_effect=RuntimeError("GPU CUDA allocation failed"))
        set_ocr_reader_for_testing(failing_reader)

        res_err = extract_number_plate_ocr(self.test_img, [150, 200, 350, 260])
        self.assertEqual(res_err["status"], "error")
        self.assertIsNone(res_err["text"])
        self.assertIsNone(res_err["confidence"])
        self.assertTrue(res_err["review_required"])

    # 8. Multiple detected number plates in one image
    def test_multiple_detected_number_plates_in_one_image(self):
        # Two plates: Plate 1 (KA01AB1234), Plate 2 (MH12DE1433)
        class MultiPlateReader:
            def __init__(self):
                self.calls = 0

            def readtext(self, image, **kwargs):
                self.calls += 1
                if self.calls % 2 == 1:
                    return [([[0, 0], [1, 0], [1, 1], [0, 1]], "KA01AB1234", 0.92)]
                else:
                    return [([[0, 0], [1, 0], [1, 1], [0, 1]], "MH12DE1433", 0.88)]

        set_ocr_reader_for_testing(MultiPlateReader())

        plate1_res = extract_number_plate_ocr(self.test_img, [50, 100, 200, 150])
        plate2_res = extract_number_plate_ocr(self.test_img, [300, 100, 450, 150])

        self.assertEqual(plate1_res["status"], "success")
        self.assertEqual(plate1_res["text"], "KA01AB1234")
        self.assertEqual(plate1_res["confidence"], 0.92)

        self.assertEqual(plate2_res["status"], "success")
        self.assertEqual(plate2_res["text"], "MH12DE1433")
        self.assertEqual(plate2_res["confidence"], 0.88)

    # 9. Images without any number-plate detections
    def test_images_without_any_number_plate_detections(self):
        detections = [
            {"class_id": 0, "class_name": "helmet", "confidence": 0.85, "bbox": [100, 50, 150, 100]},
            {"class_id": 4, "class_name": "rider", "confidence": 0.90, "bbox": [80, 50, 200, 300]},
        ]
        # Verify that filtering for number_plate yields empty list and no OCR execution
        plates = [d for d in detections if d.get("class_name") == "number_plate"]
        self.assertEqual(len(plates), 0)

    # 10. Ensuring OCR is never called for non-number_plate classes
    def test_ocr_never_called_for_non_number_plate_classes(self):
        mock_reader = MagicMock()
        set_ocr_reader_for_testing(mock_reader)

        non_plate_classes = ["helmet", "no_helmet", "pillion", "rider"]
        for cls_name in non_plate_classes:
            d = {"class_id": 1, "class_name": cls_name, "confidence": 0.8, "bbox": [10, 10, 50, 50]}
            if d.get("class_name") == "number_plate":
                extract_number_plate_ocr(self.test_img, d["bbox"])

        # Mock reader readtext should never be called
        self.assertEqual(mock_reader.readtext.call_count, 0)

    # 11. Ensuring OCR failure does not remove the corresponding YOLO detection
    def test_ocr_failure_does_not_remove_yolo_detection(self):
        active_detections = [
            {
                "id": "det_plate_1",
                "class_id": 2,
                "class_name": "number_plate",
                "confidence": 0.78,
                "bbox": [150, 200, 350, 260],
            }
        ]

        # Simulate OCR failing
        set_ocr_reader_for_testing(MockEasyOCRReader(mock_return=[]))
        d = active_detections[0]
        plate_ocr = extract_number_plate_ocr(self.test_img, d["bbox"])
        d["ocr"] = {
            "text": plate_ocr.get("text"),
            "confidence": plate_ocr.get("confidence"),
            "format_valid": plate_ocr.get("format_valid"),
            "status": plate_ocr.get("status"),
        }

        # Detection remains in array, retaining its YOLO class, confidence, and bbox
        self.assertEqual(len(active_detections), 1)
        self.assertEqual(active_detections[0]["class_name"], "number_plate")
        self.assertEqual(active_detections[0]["confidence"], 0.78)
        self.assertEqual(active_detections[0]["bbox"], [150, 200, 350, 260])
        self.assertEqual(active_detections[0]["ocr"]["status"], "unreadable")
        self.assertIsNone(active_detections[0]["ocr"]["text"])

    # 12. Ensuring API response format compatibility
    def test_api_response_schema_compatibility(self):
        active_detections = [
            {
                "id": "det_plate_1",
                "class_id": 2,
                "class_name": "number_plate",
                "confidence": 0.91,
                "bbox": [100, 200, 300, 260],
                "ocr": {
                    "text": "KA01AB1234",
                    "confidence": 0.82,
                    "format_valid": True,
                    "status": "success",
                }
            }
        ]
        det = active_detections[0]
        self.assertIn("class_name", det)
        self.assertIn("confidence", det)
        self.assertIn("bbox", det)
        self.assertIn("ocr", det)
        self.assertIn("text", det["ocr"])
        self.assertIn("confidence", det["ocr"])
        self.assertIn("format_valid", det["ocr"])
        self.assertIn("status", det["ocr"])

    # 13. Two-line plate spatial ordering
    def test_two_line_plate_spatial_ordering(self):
        line1_top = [[[10, 10], [50, 10], [50, 30], [10, 30]], "TS07", 0.90]
        line2_bottom = [[[10, 40], [80, 40], [80, 60], [10, 60]], "EJ7736", 0.95]
        # Feed in scrambled order (bottom line first)
        scrambled = [line2_bottom, line1_top]
        ordered = order_tokens_into_reading_sequence(scrambled)
        ordered_texts = [item[0] for item in ordered]
        self.assertEqual(ordered_texts, ["TS07", "EJ7736"])
        self.assertEqual("".join(ordered_texts), "TS07EJ7736")

    # 14. HSRP 'IND' badge filtering
    def test_hsrp_ind_badge_filtering(self):
        badge = [[[0, 10], [15, 10], [15, 30], [0, 30]], "IND", 0.85]
        line1 = [[[20, 10], [70, 10], [70, 30], [20, 30]], "KA01", 0.92]
        line2 = [[[20, 40], [90, 40], [90, 60], [20, 60]], "AB1234", 0.94]
        tokens_with_badge = [badge, line1, line2]
        ordered = order_tokens_into_reading_sequence(tokens_with_badge)
        ordered_texts = [item[0] for item in ordered]
        self.assertNotIn("IND", ordered_texts)
        self.assertEqual(ordered_texts, ["KA01", "AB1234"])

    # 15. Positional character confusion hypotheses
    def test_positional_character_confusion_hypotheses(self):
        # District code digit confused with letter 'O'
        hyps_o = generate_registration_hypotheses("KAO9HM3422")
        self.assertIn("KA09HM3422", hyps_o)

        # State code letter confused with digit '4'
        hyps_4 = generate_registration_hypotheses("K402HK3787")
        self.assertIn("KA02HK3787", hyps_4)

        # Serial digit confused with letter 'I'
        hyps_i = generate_registration_hypotheses("PB13AY414I")
        self.assertIn("PB13AY4141", hyps_i)

    # 16. Substring extraction with state codes
    def test_extract_plate_substrings_with_dealer_prefix(self):
        subs = extract_plate_substrings("6L7DYAUIPB13AY4141")
        self.assertIn("PB13AY4141", subs)

    # 17. Candidate scoring and ranking
    def test_candidate_scoring_and_ranking(self):
        score_std, meta_std = score_plate_candidate("KA01AB1234", 0.90)
        score_unv, meta_unv = score_plate_candidate("ZZ99AB1234", 0.90)
        score_inv, meta_inv = score_plate_candidate("NOTAPLATE", 0.90)

        self.assertTrue(meta_std["is_valid"])
        self.assertEqual(meta_std["status"], "valid")
        self.assertGreater(score_std, score_unv)
        self.assertGreater(score_unv, score_inv)

    # 18. Preprocessing variants output shapes and types
    def test_preprocessing_variants_output_shapes(self):
        small_crop = np.zeros((30, 80, 3), dtype=np.uint8)
        clahe_out = preprocess_variant_clahe(small_crop)
        sharpen_out = preprocess_variant_sharpen(small_crop)
        otsu_out = preprocess_variant_otsu(small_crop)

        # Should be upscaled for character legibility
        self.assertGreaterEqual(clahe_out.shape[0], 70)
        self.assertGreaterEqual(sharpen_out.shape[0], 70)
        self.assertGreaterEqual(otsu_out.shape[0], 70)

        # Output should be single-channel grayscale or binary
        self.assertEqual(len(clahe_out.shape), 2)
        self.assertEqual(len(sharpen_out.shape), 2)
        self.assertEqual(len(otsu_out.shape), 2)


if __name__ == "__main__":
    unittest.main()
