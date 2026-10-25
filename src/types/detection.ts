export type DetectionClass = 'helmet' | 'no_helmet' | 'number_plate' | 'pillion' | 'rider';

export type HelmetStatus = 'helmet_detected' | 'no_helmet_detected' | 'uncertain' | 'not_assessed';
export type OcrStatus = 'recognized' | 'unvalidated' | 'unreadable' | 'no_plate';
export type AssociationStatus = 'associated' | 'uncertain' | 'no_rider' | 'no_plate';
export type ReviewStatus = 'pending_review' | 'verified_violation' | 'compliant' | 'dismissed';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Bounding box tuple as returned by YOLO [x1, y1, x2, y2]
export type BBoxCoordinates = [number, number, number, number];

export interface NumberPlateOcrResult {
  text: string | null;
  confidence: number | null;
  format_valid: boolean | null;
  format_type?: string | null;
  status: 'success' | 'unreadable' | 'error';
  raw_text?: string;
  crop_base64?: string;
  notes?: string;
}

export interface DetectionItem {
  id?: string;
  class_id: number;
  class_name: DetectionClass | string;
  confidence: number; // 0.0 to 1.0
  bbox: BBoxCoordinates;
  ocr?: NumberPlateOcrResult;
  quality_status?: 'high_confidence' | 'low_confidence' | 'potential_duplicate' | 'suspicious_geometry';
  quality_warnings?: string[];
  is_suspicious?: boolean;
  geometry?: {
    width: number;
    height: number;
    area: number;
    aspect_ratio: number;
    area_pct: number;
    height_pct: number;
    width_pct: number;
  };
}

export type ClassCounts = {
  helmet: number;
  no_helmet: number;
  number_plate: number;
  pillion: number;
  rider: number;
  [key: string]: number;
};

export interface ComplianceRecord {
  id: string;
  timestamp: string;
  analysis_type: 'image' | 'video' | 'live';
  filename: string;
  registration_number: string | null;
  ocr_status: OcrStatus;
  ocr_confidence: number;
  raw_ocr_text?: string;
  helmet_status: HelmetStatus;
  helmet_confidence: number;
  association_status: AssociationStatus;
  association_confidence: number;
  violation_candidate: boolean;
  review_required: boolean;
  review_status: ReviewStatus;
  review_notes?: string;
  evidence_image_url?: string;
  plate_crop_base64?: string;
  plate_bbox?: BBoxCoordinates | null;
  rider_bbox?: BBoxCoordinates | null;
  helmet_bbox?: BBoxCoordinates | null;
  notes?: string;
}

export interface CandidateTraceItem {
  id: string;
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: BBoxCoordinates;
  status: 'retained' | 'suppressed_duplicate' | 'suppressed_conflict' | 'suppressed';
  reason: string;
}

export interface DiagnosticsData {
  model_sha256?: string;
  model_md5?: string;
  model_filename?: string;
  model_path?: string;
  model_classes?: Record<number, string> | string[];
  device?: string;
  input_resolution?: [number, number];
  inference_resolution?: number;
  conf_threshold?: number;
  iou_threshold?: number;
  max_det?: number;
  conflict_iou?: number;
  duplicate_iou?: number;
  duplicate_containment?: number;
  plate_iou?: number;
  plate_containment?: number;
  raw_detections_count?: number;
  raw_counts?: ClassCounts;
  after_yolo_nms_count?: number;
  after_duplicate_suppression_count?: number;
  suppressed_duplicates_count?: number;
  after_conflict_resolution_count?: number;
  suppressed_conflicts_count?: number;
  post_processed_count?: number;
  post_processed_counts?: ClassCounts;
  inference_time_ms?: number;
  candidates?: CandidateTraceItem[];
}

export interface PredictionResult {
  success: boolean;
  mode?: 'normal' | 'debug' | string;
  filename: string;
  timestamp?: string;
  inference_time_ms: number;
  image_width: number;
  image_height: number;
  annotated_image_url?: string;
  annotated_image_base64?: string;
  detections: DetectionItem[];
  all_candidates?: DetectionItem[];
  quality_summary?: {
    high_confidence: number;
    low_confidence: number;
    potential_duplicate: number;
    suspicious_geometry: number;
  };
  raw_detections_count?: number;
  after_yolo_nms_count?: number;
  after_duplicate_suppression_count?: number;
  after_conflict_resolution_count?: number;
  suppressed_duplicates_count?: number;
  suppressed_conflicts_count?: number;
  suppressed_duplicates?: Array<{
    retained: { id?: string; class_name: string; confidence: number; bbox: BBoxCoordinates };
    suppressed: { id?: string; class_name: string; confidence: number; bbox: BBoxCoordinates };
    iou: number;
    containment?: number;
    reason: string;
  }>;
  resolved_conflicts?: Array<{
    retained: { id?: string; class_name: string; confidence: number; bbox: BBoxCoordinates };
    suppressed: { id?: string; class_name: string; confidence: number; bbox: BBoxCoordinates };
    iou: number;
    reason: string;
  }>;
  counts: ClassCounts;
  records?: ComplianceRecord[];
  is_demo?: boolean;
  diagnostics?: DiagnosticsData;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'offline' | 'error';
  model_loaded: boolean;
  ocr_available?: boolean;
  model_name?: string;
  device?: string;
  classes?: string[];
  lastChecked?: number;
  latency_ms?: number;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  filename: string;
  fileSize: number;
  originalImageUrl: string;
  result: PredictionResult;
  analysisType?: 'image' | 'video' | 'live';
  records?: ComplianceRecord[];
}

export interface AppSettings {
  mode: 'normal' | 'debug';
  apiBaseUrl: string;
  confidenceThreshold: number; // 0.05 to 1.0 (strictly kept >= 5%)
  iouThreshold: number;        // 0.1 to 0.9
  imageSize: number;           // 320, 640, 768, 1024, 1280
  maxFileSizeMb: number;       // default 15
  demoMode: boolean;           // enable simulated predictions when backend offline
  showLabels: boolean;
  showConfidence: boolean;
  boxThickness: number;        // 1 to 4
  boxOpacity: number;          // 0.1 to 1.0
}

export interface ClassConfig {
  name: DetectionClass;
  displayName: string;
  color: string;
  bgRgba: string;
  borderClass: string;
  badgeClass: string;
  description: string;
}
