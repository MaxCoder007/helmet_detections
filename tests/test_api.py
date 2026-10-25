import unittest
from fastapi.testclient import TestClient
import numpy as np
import cv2
import io
from backend.main import app

class TestAPI(unittest.TestCase):
    def test_endpoints_with_lifespan(self):
        with TestClient(app) as client:
            # 1. Health check
            resp = client.get("/health")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["status"], "ok")
            self.assertTrue(data["model_loaded"])
            self.assertEqual(data["default_config"]["conf"], 0.25)
            self.assertEqual(data["default_config"]["min_conf"], 0.05)

            # 1b. Diagnostics check
            resp_diag = client.get("/diagnostics")
            self.assertEqual(resp_diag.status_code, 200)
            diag_data = resp_diag.json()
            self.assertEqual(diag_data["status"], "ok")
            self.assertIn("model", diag_data)
            self.assertIn("sha256", diag_data["model"])
            self.assertIn("classes", diag_data["model"])
            self.assertEqual(len(diag_data["model"]["classes"]), 5)
            self.assertEqual(diag_data["default_config"]["min_conf"], 0.05)

            # 2. Predict on synthetic image with minimum 5% confidence & conflict parameters
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(img, "KA01AB1234", (100, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
            _, encoded = cv2.imencode(".jpg", img)
            file_bytes = io.BytesIO(encoded.tobytes())

            resp_pred = client.post(
                "/predict",
                files={"file": ("traffic_sample.jpg", file_bytes, "image/jpeg")},
                params={"conf": 0.05, "iou": 0.70, "imgsz": 640, "max_det": 300, "conflict_iou": 0.40}
            )
            self.assertEqual(resp_pred.status_code, 200)
            pred_data = resp_pred.json()
            self.assertTrue(pred_data["success"])
            self.assertIn("records", pred_data)
            self.assertIn("detections", pred_data)
            self.assertIn("resolved_conflicts", pred_data)
            self.assertGreaterEqual(pred_data["settings_used"]["conf"], 0.05)
            self.assertIn("diagnostics", pred_data)
            self.assertGreaterEqual(pred_data["diagnostics"]["conf_threshold"], 0.05)
            self.assertIn("model_sha256", pred_data["diagnostics"])

            # 3. Invalid image input test (corrupted bytes)
            resp_invalid = client.post(
                "/predict",
                files={"file": ("corrupt.jpg", io.BytesIO(b"not_an_image_data"), "image/jpeg")},
            )
            self.assertEqual(resp_invalid.status_code, 400)

            # 4. Query records
            resp_rec = client.get("/records")
            self.assertEqual(resp_rec.status_code, 200)
            rec_data = resp_rec.json()
            self.assertIn("records", rec_data)
            self.assertIn("total", rec_data)

            # 5. Test approve and disapprove review endpoints
            if rec_data["records"]:
                test_rec_id = rec_data["records"][0]["id"]
                resp_app = client.patch(f"/records/{test_rec_id}/review", json={"review_status": "approved", "review_notes": "Approved test"})
                self.assertEqual(resp_app.status_code, 200)
                self.assertEqual(resp_app.json()["review_status"], "approved")

                resp_dis = client.patch(f"/records/{test_rec_id}/review", json={"review_status": "disapproved", "review_notes": "Disapproved test"})
                self.assertEqual(resp_dis.status_code, 200)
                self.assertEqual(resp_dis.json()["review_status"], "disapproved")

if __name__ == "__main__":
    unittest.main()
