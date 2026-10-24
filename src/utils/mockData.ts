import { DetectionItem, PredictionResult, ClassCounts } from '@/types/detection';

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

  // Realistic motorcycle scene detections
  const mockDetections: DetectionItem[] = [
    {
      id: 'demo-1',
      class_id: 4,
      class_name: 'rider',
      confidence: 0.942,
      bbox: [
        Math.round(w * 0.28),
        Math.round(h * 0.22),
        Math.round(w * 0.62),
        Math.round(h * 0.88),
      ],
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
      bbox: [
        Math.round(w * 0.60),
        Math.round(h * 0.30),
        Math.round(w * 0.72),
        Math.round(h * 0.45),
      ],
    },
    {
      id: 'demo-5',
      class_id: 2,
      class_name: 'number_plate',
      confidence: 0.957,
      bbox: [
        Math.round(w * 0.42),
        Math.round(h * 0.82),
        Math.round(w * 0.56),
        Math.round(h * 0.92),
      ],
    },
  ];

  const counts: ClassCounts = {
    helmet: 1,
    no_helmet: 1,
    number_plate: 1,
    pillion: 1,
    rider: 1,
  };

  return {
    success: true,
    filename,
    inference_time_ms: 38.6,
    image_width: imgWidth,
    image_height: imgHeight,
    detections: mockDetections,
    counts,
    is_demo: true,
  };
}
