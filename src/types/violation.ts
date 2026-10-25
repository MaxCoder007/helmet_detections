export type ViolationOcrStatus = 'recognized' | 'unreadable' | 'plate_not_detected';
export type VehicleAssociationStatus = 'confirmed' | 'uncertain' | 'unavailable';
export type ViolationReviewStatus = 'pending' | 'reviewed' | 'resolved';

export interface ViolationRecord {
  id: string;
  event_id?: string;
  registration_number: string | null;
  manual_registration_number: string | null;
  raw_ocr_text?: string;
  ocr_confidence: number | null;
  ocr_status: ViolationOcrStatus;
  plate_detection_confidence: number | null;
  violation_type: string;
  violation_timestamp: string;
  rider_crop_path: string | null;
  plate_crop_path: string | null;
  original_image_path: string | null;
  vehicle_association_status: VehicleAssociationStatus;
  review_status: ViolationReviewStatus;
  review_notes?: string | null;
  reviewed_at?: string | null;
  source_type: 'image' | 'video' | 'live_video';
  source_reference?: string | null;
  rider_bbox?: [number, number, number, number] | null;
  plate_bbox?: [number, number, number, number] | null;
  helmet_bbox?: [number, number, number, number] | null;
  notes?: string;
  created_at: string;
}

export interface ViolationStats {
  total_violations: number;
  recognized_vehicles: number;
  unidentified_vehicles: number;
  pending_reviews: number;
  reviewed_records: number;
}

export interface ViolationQueryParams {
  limit?: number;
  offset?: number;
  registration?: string;
  ocr_status?: string;
  review_status?: string;
  association_status?: string;
  date_from?: string;
  date_to?: string;
  violation_type?: string;
}

export interface ViolationListResponse {
  total: number;
  limit: number;
  offset: number;
  records: ViolationRecord[];
  stats: ViolationStats;
}
