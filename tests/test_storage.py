import unittest
from backend.storage import (
    init_db,
    save_compliance_record,
    get_compliance_record,
    list_compliance_records,
    update_review_status,
    delete_compliance_record,
    check_deduplication
)

class TestStorage(unittest.TestCase):
    def setUp(self):
        init_db()

    def test_save_and_retrieve_record(self):
        rec_id = f"test_rec_{unittest.TestCase.id(self)}"
        rec = {
            "id": rec_id,
            "timestamp": "2026-10-24T12:00:00Z",
            "analysis_type": "image",
            "filename": "test_traffic.jpg",
            "registration_number": "KA01AB1234",
            "ocr_status": "recognized",
            "ocr_confidence": 0.96,
            "raw_ocr_text": "KA01AB1234",
            "helmet_status": "no_helmet_detected",
            "helmet_confidence": 0.89,
            "association_status": "associated",
            "association_confidence": 0.92,
            "violation_candidate": True,
            "review_required": True,
            "review_status": "pending_review",
            "evidence_image_url": "/results/annotated_test.jpg",
            "plate_bbox": [100, 200, 150, 230],
        }

        saved_id = save_compliance_record(rec)
        self.assertEqual(saved_id, rec_id)

        fetched = get_compliance_record(rec_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["registration_number"], "KA01AB1234")
        self.assertEqual(fetched["helmet_status"], "no_helmet_detected")
        self.assertTrue(fetched["violation_candidate"])

        # Update review status
        updated = update_review_status(rec_id, "verified_violation", "Verified by traffic inspector.")
        self.assertTrue(updated)
        fetched_updated = get_compliance_record(rec_id)
        self.assertEqual(fetched_updated["review_status"], "verified_violation")
        self.assertEqual(fetched_updated["review_notes"], "Verified by traffic inspector.")

        # Update review status to approved
        updated_app = update_review_status(rec_id, "approved", "Approved by reviewer.")
        self.assertTrue(updated_app)
        fetched_app = get_compliance_record(rec_id)
        self.assertEqual(fetched_app["review_status"], "approved")

        # Update review status to disapproved
        updated_dis = update_review_status(rec_id, "disapproved", "Disapproved: false positive.")
        self.assertTrue(updated_dis)
        fetched_dis = get_compliance_record(rec_id)
        self.assertEqual(fetched_dis["review_status"], "disapproved")

        # Clean up
        deleted = delete_compliance_record(rec_id)
        self.assertTrue(deleted)
        self.assertIsNone(get_compliance_record(rec_id))

    def test_deduplication_cooldown(self):
        plate = "DL04E9999"
        # First occurrence: allowed
        throttled1 = check_deduplication(plate, cooldown_seconds=5.0)
        self.assertFalse(throttled1)

        # Immediate second occurrence: throttled
        throttled2 = check_deduplication(plate, cooldown_seconds=5.0)
        self.assertTrue(throttled2)

if __name__ == "__main__":
    unittest.main()
