"""
Comprehensive Unit and Integration Tests for the Number Plate Violation Register.

Tests all 14 specified requirements:
1. No-helmet event with readable plate text (Case A).
2. No-helmet event with unreadable plate (Case B).
3. No-helmet event where no plate is detected (Case C).
4. Plate detected but associated with rider uncertainly (Case D).
5. Multiple motorcycles and separate riders in one image.
6. Evidence-image cropping and storage.
7. Missing evidence files graceful handling.
8. Database persistence and retrieval.
9. Pagination and filtering.
10. Unauthorized / path-traversal evidence access protection.
11. Duplicate requests for the same event (image upload idempotency).
12. Consecutive live-video frames without duplicate database records.
13. Manual review and registration-number correction (preserving original OCR).
14. Existing YOLO and OCR response contract compatibility.
"""

import unittest
import shutil
import time
from pathlib import Path
import numpy as np
import cv2
from fastapi.testclient import TestClient

from backend.main import app
from backend.violation_storage import (
    init_violation_db,
    insert_violation_record,
    get_violation,
    list_violations,
    update_violation,
    get_violation_summary_stats,
    get_evidence_file_path,
    save_violation_evidence,
    EVIDENCE_DIR,
)
from backend.violation_service import (
    process_and_record_violations,
    associate_violating_riders,
    clear_dedup_cache,
)


class TestViolationRegister(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_violation_db()

    def setUp(self):
        clear_dedup_cache()
        # Synthetic test image 640x480
        self.test_img = np.zeros((480, 640, 3), dtype=np.uint8)
        # White motorcycle shape
        cv2.rectangle(self.test_img, (150, 100), (350, 450), (200, 200, 200), -1)

    # 1. No-helmet event with readable plate text (Case A)
    def test_case_a_readable_plate_violation(self):
        detections = [
            {"class_name": "rider", "confidence": 0.88, "bbox": [150, 100, 350, 420]},
            {"class_name": "no_helmet", "confidence": 0.85, "bbox": [210, 110, 290, 200]},
        ]
        ocr_results = [
            {
                "registration_number": "KA01AB1234",
                "raw_ocr_text": "KA01AB1234",
                "ocr_confidence": 0.91,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.89,
                "plate_bbox": [200, 380, 300, 440],
            }
        ]
        violations = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="test_case_a.jpg"
        )
        self.assertEqual(len(violations), 1)
        v = violations[0]
        self.assertEqual(v["registration_number"], "KA01AB1234")
        self.assertEqual(v["ocr_status"], "recognized")
        self.assertEqual(v["vehicle_association_status"], "confirmed")
        self.assertEqual(v["violation_type"], "no_helmet")
        self.assertIsNotNone(v["plate_crop_path"])
        self.assertIsNotNone(v["original_image_path"])

    # 2. No-helmet event with unreadable plate (Case B)
    def test_case_b_unreadable_plate_violation(self):
        detections = [
            {"class_name": "rider", "confidence": 0.90, "bbox": [150, 100, 350, 420]},
            {"class_name": "no_helmet", "confidence": 0.82, "bbox": [210, 110, 290, 200]},
        ]
        ocr_results = [
            {
                "registration_number": None,
                "raw_ocr_text": "??#",
                "ocr_confidence": 0.15,
                "status": "unreadable",
                "ocr_status": "unreadable",
                "plate_confidence": 0.84,
                "plate_bbox": [200, 380, 300, 440],
            }
        ]
        violations = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="test_case_b.jpg"
        )
        self.assertEqual(len(violations), 1)
        v = violations[0]
        # Never fabricate a registration number
        self.assertIsNone(v["registration_number"])
        self.assertEqual(v["ocr_status"], "unreadable")
        self.assertEqual(v["vehicle_association_status"], "confirmed")
        # Number-plate crop MUST be preserved even when OCR fails
        self.assertIsNotNone(v["plate_crop_path"])

    # 3. No-helmet event where no plate is detected (Case C)
    def test_case_c_no_plate_detected_violation(self):
        detections = [
            {"class_name": "rider", "confidence": 0.85, "bbox": [150, 100, 350, 420]},
            {"class_name": "no_helmet", "confidence": 0.79, "bbox": [210, 110, 290, 200]},
        ]
        # Empty OCR plate results (no number plate detected by YOLO)
        ocr_results = []
        violations = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="test_case_c.jpg"
        )
        self.assertEqual(len(violations), 1)
        v = violations[0]
        self.assertIsNone(v["registration_number"])
        self.assertEqual(v["ocr_status"], "plate_not_detected")
        self.assertEqual(v["vehicle_association_status"], "unavailable")
        # Must NOT create a fake plate crop when no plate was detected
        self.assertIsNone(v["plate_crop_path"])
        # Rider crop and original image MUST be preserved
        self.assertIsNotNone(v["rider_crop_path"])
        self.assertIsNotNone(v["original_image_path"])

    # 4. Plate detected but associated with rider uncertainly (Case D)
    def test_case_d_uncertain_plate_association(self):
        # Two riders side by side competing for a plate
        detections = [
            {"class_name": "rider", "confidence": 0.85, "bbox": [100, 100, 250, 400]},
            {"class_name": "no_helmet", "confidence": 0.80, "bbox": [140, 110, 210, 190]},
            {"class_name": "rider", "confidence": 0.86, "bbox": [240, 100, 390, 400]},
            {"class_name": "no_helmet", "confidence": 0.82, "bbox": [280, 110, 350, 190]},
        ]
        # Single central number plate
        ocr_results = [
            {
                "registration_number": "MH12DE1433",
                "raw_ocr_text": "MH12DE1433",
                "ocr_confidence": 0.88,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.90,
                "plate_bbox": [220, 380, 300, 430],
            }
        ]
        violations = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="test_case_d.jpg"
        )
        self.assertEqual(len(violations), 2)
        # Association must be marked uncertain due to competition
        self.assertTrue(any(v["vehicle_association_status"] == "uncertain" for v in violations))

    # 5. Multiple motorcycles and separate riders in one image
    def test_multiple_motorcycles_and_separate_riders(self):
        # Motorcycle 1 on left (KA01AB1234)
        # Motorcycle 2 on right (DL8CAF5030)
        detections = [
            {"class_name": "rider", "confidence": 0.92, "bbox": [50, 100, 200, 400]},
            {"class_name": "no_helmet", "confidence": 0.89, "bbox": [90, 110, 160, 190]},
            {"class_name": "rider", "confidence": 0.91, "bbox": [400, 100, 550, 400]},
            {"class_name": "no_helmet", "confidence": 0.87, "bbox": [440, 110, 510, 190]},
        ]
        ocr_results = [
            {
                "registration_number": "KA01AB1234",
                "raw_ocr_text": "KA01AB1234",
                "ocr_confidence": 0.92,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.88,
                "plate_bbox": [80, 370, 170, 420],
            },
            {
                "registration_number": "DL8CAF5030",
                "raw_ocr_text": "DL8CAF5030",
                "ocr_confidence": 0.90,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.87,
                "plate_bbox": [430, 370, 520, 420],
            }
        ]
        violations = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="test_multiple_bikes.jpg"
        )
        self.assertEqual(len(violations), 2)
        plates = {v["registration_number"] for v in violations}
        self.assertEqual(plates, {"KA01AB1234", "DL8CAF5030"})
        # Distinct violation records
        self.assertNotEqual(violations[0]["id"], violations[1]["id"])

    # 6. Evidence-image cropping and storage
    def test_evidence_cropping_and_storage(self):
        viol_id = "test_evidence_storage_01"
        paths = save_violation_evidence(
            violation_id=viol_id,
            original_bgr=self.test_img,
            rider_bbox=[150, 100, 350, 420],
            plate_bbox=[200, 380, 300, 440]
        )
        self.assertIsNotNone(paths["original_image_path"])
        self.assertIsNotNone(paths["rider_crop_path"])
        self.assertIsNotNone(paths["plate_crop_path"])

        orig_file = get_evidence_file_path(viol_id, "original")
        rider_file = get_evidence_file_path(viol_id, "rider")
        plate_file = get_evidence_file_path(viol_id, "number_plate")

        self.assertIsNotNone(orig_file)
        self.assertIsNotNone(rider_file)
        self.assertIsNotNone(plate_file)
        self.assertTrue(orig_file.exists())
        self.assertTrue(rider_file.exists())
        self.assertTrue(plate_file.exists())

        # Cleanup test directory
        shutil.rmtree(EVIDENCE_DIR / viol_id, ignore_errors=True)

    # 7. Missing evidence files graceful handling
    def test_missing_evidence_files_handling(self):
        with TestClient(app) as client:
            res = client.get("/api/violations/non_existent_viol_999/evidence/original")
            self.assertEqual(res.status_code, 404)
            self.assertIn("not found", res.json().get("detail", "").lower())

    # 8. Database persistence and retrieval
    def test_database_persistence_and_retrieval(self):
        rec_id = "test_persist_v01"
        insert_violation_record({
            "id": rec_id,
            "event_id": "ev_test_01",
            "registration_number": "KA04JD5128",
            "ocr_status": "recognized",
            "ocr_confidence": 0.89,
            "violation_type": "no_helmet",
            "violation_timestamp": "2026-10-25T11:00:00Z",
            "vehicle_association_status": "confirmed",
            "review_status": "pending",
        })
        fetched = get_violation(rec_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], rec_id)
        self.assertEqual(fetched["registration_number"], "KA04JD5128")
        self.assertEqual(fetched["ocr_status"], "recognized")
        self.assertEqual(fetched["review_status"], "pending")

    # 9. Pagination and filtering
    def test_pagination_and_filtering(self):
        for i in range(5):
            insert_violation_record({
                "id": f"test_filter_v{i}",
                "registration_number": f"MH01AB000{i}",
                "ocr_status": "recognized" if i % 2 == 0 else "unreadable",
                "violation_type": "no_helmet",
                "violation_timestamp": f"2026-10-25T10:0{i}:00Z",
                "review_status": "reviewed" if i == 0 else "pending",
            })

        with TestClient(app) as client:
            # Test limit and offset
            res_page = client.get("/api/violations?limit=2&offset=0")
            self.assertEqual(res_page.status_code, 200)
            data = res_page.json()
            self.assertEqual(len(data["records"]), 2)
            self.assertGreaterEqual(data["total"], 5)

            # Test OCR status filter
            res_ocr = client.get("/api/violations?ocr_status=unreadable")
            self.assertEqual(res_ocr.status_code, 200)
            for r in res_ocr.json()["records"]:
                self.assertEqual(r["ocr_status"], "unreadable")

            # Test review status filter
            res_rev = client.get("/api/violations?review_status=reviewed")
            self.assertEqual(res_rev.status_code, 200)
            for r in res_rev.json()["records"]:
                self.assertEqual(r["review_status"], "reviewed")

    # 10. Unauthorized / path traversal evidence access protection
    def test_path_traversal_protection(self):
        # Attempt traversal via violation_id
        path_traversal = get_evidence_file_path("../../../etc/passwd", "original")
        self.assertIsNone(path_traversal)

        path_traversal2 = get_evidence_file_path("viol_test/../../something", "original")
        self.assertIsNone(path_traversal2)

        # Attempt invalid evidence type
        invalid_type = get_evidence_file_path("test_id", "malicious_script")
        self.assertIsNone(invalid_type)

    # 11. Duplicate requests for the same event (image upload idempotency)
    def test_image_upload_idempotency(self):
        detections = [
            {"class_name": "rider", "confidence": 0.88, "bbox": [150, 100, 350, 420]},
            {"class_name": "no_helmet", "confidence": 0.85, "bbox": [210, 110, 290, 200]},
        ]
        ocr_results = [
            {
                "registration_number": "DL8CAF5030",
                "raw_ocr_text": "DL8CAF5030",
                "ocr_confidence": 0.90,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.88,
                "plate_bbox": [200, 380, 300, 440],
            }
        ]
        # First call: creates record
        v1 = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="idempotent_test_img.jpg"
        )
        self.assertEqual(len(v1), 1)

        # Immediate repeated call: throttled
        v2 = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="image",
            source_reference="idempotent_test_img.jpg"
        )
        self.assertEqual(len(v2), 0)

    # 12. Consecutive live-video frames without duplicate database records
    def test_live_video_frame_deduplication(self):
        detections = [
            {"class_name": "rider", "confidence": 0.88, "bbox": [150, 100, 350, 420]},
            {"class_name": "no_helmet", "confidence": 0.85, "bbox": [210, 110, 290, 200]},
        ]
        ocr_results = [
            {
                "registration_number": "KA04HF8744",
                "raw_ocr_text": "KA04HF8744",
                "ocr_confidence": 0.92,
                "status": "success",
                "ocr_status": "recognized",
                "plate_confidence": 0.91,
                "plate_bbox": [200, 380, 300, 440],
            }
        ]
        # Frame 1: creates violation
        f1 = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="live_video",
            source_reference="cam_traffic_01",
            cooldown_seconds=8.0
        )
        self.assertEqual(len(f1), 1)

        # Frame 2 (consecutive frame 100ms later): throttled
        f2 = process_and_record_violations(
            image_bgr=self.test_img,
            active_detections=detections,
            ocr_plate_results=ocr_results,
            source_type="live_video",
            source_reference="cam_traffic_01",
            cooldown_seconds=8.0
        )
        self.assertEqual(len(f2), 0)

    # 13. Manual review and registration-number correction
    def test_manual_review_and_registration_correction(self):
        rec_id = "test_review_correction_01"
        insert_violation_record({
            "id": rec_id,
            "registration_number": None,
            "raw_ocr_text": "KAO4HF8744",
            "ocr_status": "unreadable",
            "ocr_confidence": 0.40,
            "violation_type": "no_helmet",
            "violation_timestamp": "2026-10-25T11:15:00Z",
            "review_status": "pending",
        })

        # Manual correction via API
        payload = {
            "review_status": "reviewed",
            "manual_registration_number": "KA04HF8744",
            "review_notes": "Manually verified blurred plate from rider crop."
        }
        with TestClient(app) as client:
            res = client.patch(f"/api/violations/{rec_id}", json=payload)
            self.assertEqual(res.status_code, 200)

        updated = get_violation(rec_id)
        self.assertEqual(updated["review_status"], "reviewed")
        self.assertEqual(updated["manual_registration_number"], "KA04HF8744")
        # Ensure original raw OCR result was preserved intact!
        self.assertEqual(updated["raw_ocr_text"], "KAO4HF8744")
        self.assertEqual(updated["review_notes"], "Manually verified blurred plate from rider crop.")

    # 14. Existing YOLO and OCR behavior remaining unchanged
    def test_existing_predict_response_contract_compatibility(self):
        # Synthetic test image upload to /predict
        _, enc = cv2.imencode(".jpg", self.test_img)
        files = {"file": ("test_predict.jpg", enc.tobytes(), "image/jpeg")}
        with TestClient(app) as client:
            res = client.post("/predict", files=files, params={"conf": 0.05, "iou": 0.45})
            self.assertEqual(res.status_code, 200)
            data = res.json()

            # All existing fields remain present
            self.assertIn("success", data)
            self.assertIn("filename", data)
            self.assertIn("detections", data)
            self.assertIn("counts", data)
            self.assertIn("records", data)
            self.assertIn("quality_summary", data)
            self.assertIn("annotated_image_url", data)

            # New violation register fields are seamlessly attached
            self.assertIn("violations", data)
            self.assertIn("violations_recorded", data)

    # 15. Export all violations as CSV and JSON
    def test_export_all_violations_csv_and_json(self):
        rec_id = insert_violation_record({
            "registration_number": "DL9CAA1234",
            "ocr_status": "recognized",
            "ocr_confidence": 0.95,
            "vehicle_association_status": "confirmed",
            "source_type": "image",
            "source_reference": "export_test.jpg",
        })
        with TestClient(app) as client:
            # CSV export
            res_csv = client.get("/api/violations/export?format=csv")
            self.assertEqual(res_csv.status_code, 200)
            self.assertEqual(res_csv.headers["content-type"], "text/csv; charset=utf-8")
            self.assertIn("attachment; filename=", res_csv.headers["content-disposition"])
            self.assertIn("DL9CAA1234", res_csv.text)
            self.assertIn("violation_timestamp", res_csv.text)

            # JSON export
            res_json = client.get("/api/violations/export?format=json")
            self.assertEqual(res_json.status_code, 200)
            self.assertEqual(res_json.headers["content-type"], "application/json")
            self.assertIn("attachment; filename=", res_json.headers["content-disposition"])
            data = res_json.json()
            self.assertIn("records", data)
            self.assertGreaterEqual(data["total_records"], 1)

    # 16. Export single violation record as JSON and CSV
    def test_export_single_violation_json_and_csv(self):
        rec_id = insert_violation_record({
            "registration_number": "TS09NL0786",
            "ocr_status": "recognized",
            "ocr_confidence": 0.92,
            "vehicle_association_status": "confirmed",
            "source_type": "image",
            "source_reference": "single_export_test.jpg",
        })
        with TestClient(app) as client:
            # JSON single export
            res_json = client.get(f"/api/violations/{rec_id}/export?format=json")
            self.assertEqual(res_json.status_code, 200)
            self.assertEqual(res_json.headers["content-type"], "application/json")
            data = res_json.json()
            self.assertEqual(data["id"], rec_id)
            self.assertEqual(data["registration_number"], "TS09NL0786")

            # CSV single export
            res_csv = client.get(f"/api/violations/{rec_id}/export?format=csv")
            self.assertEqual(res_csv.status_code, 200)
            self.assertIn("TS09NL0786", res_csv.text)


if __name__ == "__main__":
    unittest.main()
