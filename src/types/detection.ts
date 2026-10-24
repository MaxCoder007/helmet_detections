export type DetectionClass = 'helmet' | 'no_helmet' | 'number_plate' | 'pillion' | 'rider';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Bounding box tuple as returned by YOLO [x1, y1, x2, y2]
export type BBoxCoordinates = [number, number, number, number];

export interface DetectionItem {
  id?: string;
  class_id: number;
  class_name: DetectionClass | string;
  confidence: number; // 0.0 to 1.0
  bbox: BBoxCoordinates;
}

export type ClassCounts = {
  helmet: number;
  no_helmet: number;
  number_plate: number;
  pillion: number;
  rider: number;
  [key: string]: number;
};

export interface PredictionResult {
  success: boolean;
  filename: string;
  inference_time_ms: number;
  image_width: number;
  image_height: number;
  annotated_image_url?: string;
  annotated_image_base64?: string;
  detections: DetectionItem[];
  counts: ClassCounts;
  is_demo?: boolean;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'offline' | 'error';
  model_loaded: boolean;
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
}

export interface AppSettings {
  apiBaseUrl: string;
  confidenceThreshold: number; // 0.05 to 1.0
  iouThreshold: number;        // 0.1 to 0.9
  imageSize: number;           // 320, 640, 768, 1024
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
