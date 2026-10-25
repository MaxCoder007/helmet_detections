import { DetectionItem, PredictionResult, ClassCounts, ComplianceRecord } from '@/types/detection';

/**
 * Generate simulated prediction results for UI evaluation when backend is offline
 * Strictly flagged with is_demo: true
 */
export function generateDemoPrediction(
  filename: string,
  imgWidth: number,
  imgHeight: number
): PredictionResult {
  // Bounding boxes scaled to image dimensions
  const w = imgWidth;
  const h = imgHeight;

  const plateBBox: [number, number, number, number] = [
    Math.round(w * 0.42),
    Math.round(h * 0.82),
    Math.round(w * 0.56),
    Math.round(h * 0.92),
  ];

  const riderBBox: [number, number, number, number] = [
    Math.round(w * 0.28),
    Math.round(h * 0.22),
    Math.round(w * 0.62),
    Math.round(h * 0.88),
  ];

  const noHelmetBBox: [number, number, number, number] = [
    Math.round(w * 0.60),
    Math.round(h * 0.30),
    Math.round(w * 0.72),
    Math.round(h * 0.45),
  ];

  // Realistic motorcycle scene detections
  const mockDetections: DetectionItem[] = [
    {
      id: 'demo-1',
      class_id: 4,
      class_name: 'rider',
      confidence: 0.942,
      bbox: riderBBox,
    },
    {
      id: 'demo-2',
      class_id: 0,
      class_name: 'helmet',
      confidence: 0.918,
      bbox: [
        Math.round(w * 0.38),
        Math.round(h * 0.22),
        Math.round(w * 0.52),
        Math.round(h * 0.40),
      ],
    },
    {
      id: 'demo-3',
      class_id: 3,
      class_name: 'pillion',
      confidence: 0.865,
      bbox: [
        Math.round(w * 0.54),
        Math.round(h * 0.30),
        Math.round(w * 0.78),
        Math.round(h * 0.82),
      ],
    },
    {
      id: 'demo-4',
      class_id: 1,
      class_name: 'no_helmet',
      confidence: 0.884,
      bbox: noHelmetBBox,
    },
    {
      id: 'demo-5',
      class_id: 2,
      class_name: 'number_plate',
      confidence: 0.957,
      bbox: plateBBox,
      ocr: {
        text: 'KA01AB1234',
        confidence: 0.885,
        format_valid: true,
        format_type: 'standard',
        status: 'success',
        raw_text: 'KA 01 AB 1234',
      },
    },
  ];

  const counts: ClassCounts = {
    helmet: 1,
    no_helmet: 1,
    number_plate: 1,
    pillion: 1,
    rider: 1,
  };

  const mockRecords: ComplianceRecord[] = [
    {
      id: `rec-demo-${Date.now()}`,
      timestamp: new Date().toISOString(),
      analysis_type: 'image',
      filename,
      registration_number: 'KA01AB1234',
      ocr_status: 'recognized',
      ocr_confidence: 0.962,
      raw_ocr_text: 'KA01AB1234',
      helmet_status: 'no_helmet_detected',
      helmet_confidence: 0.884,
      association_status: 'associated',
      association_confidence: 0.935,
      violation_candidate: true,
      review_required: true,
      review_status: 'pending_review',
      review_notes: 'Demo mode simulated violation detection.',
      plate_bbox: plateBBox,
      rider_bbox: riderBBox,
      helmet_bbox: noHelmetBBox,
      notes: 'Format: standard (Karnataka), Pillion passenger detected without helmet.',
    },
  ];

  return {
    success: true,
    filename,
    timestamp: new Date().toISOString(),
    inference_time_ms: 38.6,
    image_width: imgWidth,
    image_height: imgHeight,
    detections: mockDetections,
    counts,
    records: mockRecords,
    is_demo: true,
  };
}
