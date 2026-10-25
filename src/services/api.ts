import { HealthStatus, PredictionResult, ComplianceRecord, ReviewStatus, DiagnosticsData } from '@/types/detection';

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Perform a health check against the configured FastAPI backend
 */
export async function checkBackendHealth(baseUrl: string): Promise<HealthStatus> {
  const url = `${baseUrl.replace(/\/+$/, '')}/health`;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        status: 'error',
        model_loaded: false,
        latency_ms: latency,
        lastChecked: Date.now(),
      };
    }

    const data = await response.json();

    return {
      status: data.status === 'ok' ? 'ok' : 'degraded',
      model_loaded: Boolean(data.model_loaded),
      ocr_available: Boolean(data.ocr_available),
      model_name: data.model_name || data.model || 'YOLO11n + OCR',
      device: data.device || 'CPU',
      classes: data.classes || ['helmet', 'no_helmet', 'number_plate', 'pillion', 'rider'],
      latency_ms: latency,
      lastChecked: Date.now(),
    };
  } catch {
    const latency = Math.round(performance.now() - startTime);
    return {
      status: 'offline',
      model_loaded: false,
      latency_ms: latency,
      lastChecked: Date.now(),
    };
  }
}

export interface PredictOptions {
  mode?: 'normal' | 'debug';
  conf?: number;
  iou?: number;
  imgsz?: number;
  max_det?: number;
  conflict_iou?: number;
  analysis_type?: 'image' | 'video' | 'live';
  save_record?: boolean;
  signal?: AbortSignal;
}

/**
 * Send an image to POST /predict
 */
export async function runInference(
  baseUrl: string,
  imageFile: File | Blob,
  options: PredictOptions = {}
): Promise<PredictionResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/predict`;

  const formData = new FormData();
  formData.append('file', imageFile);

  // Append optional query parameters if specified
  const queryParams = new URLSearchParams();
  if (options.mode !== undefined) queryParams.append('mode', options.mode);
  if (options.conf !== undefined) queryParams.append('conf', String(options.conf));
  if (options.iou !== undefined) queryParams.append('iou', String(options.iou));
  if (options.imgsz !== undefined) queryParams.append('imgsz', String(options.imgsz));
  if (options.max_det !== undefined) queryParams.append('max_det', String(options.max_det));
  if (options.conflict_iou !== undefined) queryParams.append('conflict_iou', String(options.conflict_iou));
  if (options.analysis_type !== undefined) queryParams.append('analysis_type', options.analysis_type);
  if (options.save_record !== undefined) queryParams.append('save_record', String(options.save_record));

  const finalUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

  let response: Response;
  try {
    response = await fetch(finalUrl, {
      method: 'POST',
      body: formData,
      signal: options.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Inference request was canceled.', 0);
    }
    throw new ApiError(
      `Cannot connect to backend at ${baseUrl}. Ensure FastAPI is running and CORS is enabled.`,
      0
    );
  }

  // Handle various HTTP error codes
  if (!response.ok) {
    let errorDetail = `Server returned HTTP ${response.status} (${response.statusText})`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorDetail = errorJson.detail;
        } else if (Array.isArray(errorJson.detail)) {
          errorDetail = errorJson.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
        }
      } else if (errorJson.message) {
        errorDetail = errorJson.message;
      }
    } catch {
      // Body not JSON
    }

    if (response.status === 413) {
      throw new ApiError('Uploaded image exceeds the server maximum payload size.', 413);
    } else if (response.status === 422) {
      throw new ApiError(`Validation error: ${errorDetail}`, 422);
    } else if (response.status === 500) {
      throw new ApiError(`Internal server error during model execution: ${errorDetail}`, 500);
    }
    throw new ApiError(errorDetail, response.status);
  }

  let jsonResult: unknown;
  try {
    jsonResult = await response.json();
  } catch {
    throw new ApiError('Invalid JSON response returned by the backend.', 500);
  }

  // Contract normalization
  const data = jsonResult as Record<string, unknown>;

  if (typeof data !== 'object' || data === null) {
    throw new ApiError('Malformed API response structure.', 500);
  }

  // Format detections into normalized DetectionItem[]
  const rawDetections = Array.isArray(data.detections) ? data.detections : [];
  const normalizedDetections = rawDetections.map((d: Record<string, unknown>, idx: number) => {
    const rawBbox = d.bbox;
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    if (Array.isArray(rawBbox) && rawBbox.length === 4) {
      [x1, y1, x2, y2] = rawBbox.map(Number);
    }

    const detId = typeof d.id === 'string' && d.id ? d.id : `det-${idx + 1}-${Date.now()}`;
    const ocrRaw = typeof d.ocr === 'object' && d.ocr !== null ? (d.ocr as Record<string, unknown>) : undefined;
    const ocrNormalized = ocrRaw
      ? {
          text: typeof ocrRaw.text === 'string' ? ocrRaw.text : null,
          confidence: typeof ocrRaw.confidence === 'number' ? ocrRaw.confidence : null,
          format_valid: typeof ocrRaw.format_valid === 'boolean' ? ocrRaw.format_valid : null,
          format_type: typeof ocrRaw.format_type === 'string' ? ocrRaw.format_type : null,
          status: (typeof ocrRaw.status === 'string' ? ocrRaw.status : 'unreadable') as 'success' | 'unreadable' | 'error',
          raw_text: typeof ocrRaw.raw_text === 'string' ? ocrRaw.raw_text : undefined,
          crop_base64: typeof ocrRaw.crop_base64 === 'string' ? ocrRaw.crop_base64 : undefined,
          notes: typeof ocrRaw.notes === 'string' ? ocrRaw.notes : undefined,
        }
      : undefined;

    return {
      id: detId,
      class_id: Number(d.class_id ?? 0),
      class_name: String(d.class_name ?? 'unknown'),
      confidence: Number(d.confidence ?? 0),
      bbox: [x1, y1, x2, y2] as [number, number, number, number],
      ocr: ocrNormalized,
      quality_status: typeof d.quality_status === 'string' ? (d.quality_status as any) : undefined,
      quality_warnings: Array.isArray(d.quality_warnings) ? d.quality_warnings.map(String) : undefined,
    };
  });

  // Normalize counts
  const rawCounts = (data.counts as Record<string, number>) || {};
  const normalizedCounts = {
    helmet: Number(rawCounts.helmet || 0),
    no_helmet: Number(rawCounts.no_helmet || 0),
    number_plate: Number(rawCounts.number_plate || 0),
    pillion: Number(rawCounts.pillion || 0),
    rider: Number(rawCounts.rider || 0),
  };

  // If counts were not provided by the API, compute them from detections
  if (!data.counts) {
    for (const det of normalizedDetections) {
      const cname = det.class_name as keyof typeof normalizedCounts;
      if (normalizedCounts[cname] !== undefined) {
        normalizedCounts[cname] += 1;
      }
    }
  }

  // Format annotated image URL if it's relative
  let annotatedUrl = typeof data.annotated_image_url === 'string' ? data.annotated_image_url : undefined;
  if (annotatedUrl && !annotatedUrl.startsWith('http') && !annotatedUrl.startsWith('data:')) {
    annotatedUrl = `${baseUrl.replace(/\/+$/, '')}/${annotatedUrl.replace(/^\/+/, '')}`;
  }

  // Normalize compliance records
  const rawRecords = Array.isArray(data.records) ? data.records : [];
  const normalizedRecords: ComplianceRecord[] = rawRecords.map((r: Record<string, unknown>) => {
    let evidenceUrl = typeof r.evidence_image_url === 'string' ? r.evidence_image_url : annotatedUrl;
    if (evidenceUrl && !evidenceUrl.startsWith('http') && !evidenceUrl.startsWith('data:')) {
      evidenceUrl = `${baseUrl.replace(/\/+$/, '')}/${evidenceUrl.replace(/^\/+/, '')}`;
    }

    return {
      id: String(r.id || `rec-${Date.now()}`),
      timestamp: String(r.timestamp || new Date().toISOString()),
      analysis_type: (r.analysis_type as 'image' | 'video' | 'live') || 'image',
      filename: String(r.filename || data.filename || 'image.jpg'),
      registration_number: r.registration_number ? String(r.registration_number) : null,
      ocr_status: (r.ocr_status as ComplianceRecord['ocr_status']) || 'unreadable',
      ocr_confidence: Number(r.ocr_confidence || 0),
      raw_ocr_text: typeof r.raw_ocr_text === 'string' ? r.raw_ocr_text : undefined,
      helmet_status: (r.helmet_status as ComplianceRecord['helmet_status']) || 'not_assessed',
      helmet_confidence: Number(r.helmet_confidence || 0),
      association_status: (r.association_status as ComplianceRecord['association_status']) || 'uncertain',
      association_confidence: Number(r.association_confidence || 0),
      violation_candidate: Boolean(r.violation_candidate),
      review_required: Boolean(r.review_required),
      review_status: (r.review_status as ComplianceRecord['review_status']) || 'pending_review',
      review_notes: typeof r.review_notes === 'string' ? r.review_notes : undefined,
      evidence_image_url: evidenceUrl,
      plate_crop_base64: typeof r.plate_crop_base64 === 'string' ? r.plate_crop_base64 : undefined,
      plate_bbox: Array.isArray(r.plate_bbox) ? (r.plate_bbox as [number, number, number, number]) : null,
      rider_bbox: Array.isArray(r.rider_bbox) ? (r.rider_bbox as [number, number, number, number]) : null,
      helmet_bbox: Array.isArray(r.helmet_bbox) ? (r.helmet_bbox as [number, number, number, number]) : null,
      notes: typeof r.notes === 'string' ? r.notes : undefined,
    };
  });

  return {
    success: Boolean(data.success ?? true),
    filename: String(data.filename ?? 'image.jpg'),
    timestamp: String(data.timestamp ?? new Date().toISOString()),
    inference_time_ms: Number(data.inference_time_ms ?? 0),
    image_width: Number(data.image_width ?? 0),
    image_height: Number(data.image_height ?? 0),
    annotated_image_url: annotatedUrl,
    annotated_image_base64: typeof data.annotated_image_base64 === 'string' ? data.annotated_image_base64 : undefined,
    detections: normalizedDetections,
    raw_detections_count: Number(data.raw_detections_count || normalizedDetections.length),
    after_yolo_nms_count: Number(data.after_yolo_nms_count || data.raw_detections_count || normalizedDetections.length),
    after_duplicate_suppression_count: Number(data.after_duplicate_suppression_count || normalizedDetections.length),
    after_conflict_resolution_count: Number(data.after_conflict_resolution_count || normalizedDetections.length),
    suppressed_duplicates_count: Number(data.suppressed_duplicates_count || 0),
    suppressed_conflicts_count: Number(data.suppressed_conflicts_count || 0),
    suppressed_duplicates: Array.isArray(data.suppressed_duplicates) ? data.suppressed_duplicates : [],
    resolved_conflicts: Array.isArray(data.resolved_conflicts) ? data.resolved_conflicts : [],
    counts: normalizedCounts,
    records: normalizedRecords,
    is_demo: false,
    diagnostics: data.diagnostics as DiagnosticsData | undefined,
  };
}

/**
 * Fetch compliance records saved in the backend database
 */
export async function fetchBackendRecords(
  baseUrl: string,
  params: {
    limit?: number;
    offset?: number;
    registration?: string;
    helmet_status?: string;
    review_status?: string;
    violation_only?: boolean;
  } = {}
): Promise<{ total: number; limit: number; offset: number; records: ComplianceRecord[] }> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.append('limit', String(params.limit));
  if (params.offset !== undefined) query.append('offset', String(params.offset));
  if (params.registration) query.append('registration', params.registration);
  if (params.helmet_status && params.helmet_status !== 'all') query.append('helmet_status', params.helmet_status);
  if (params.review_status && params.review_status !== 'all') query.append('review_status', params.review_status);
  if (params.violation_only) query.append('violation_only', 'true');

  const url = `${baseUrl.replace(/\/+$/, '')}/records?${query.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new ApiError(`Failed to fetch records: ${resp.statusText}`, resp.status);
  }
  return await resp.json();
}

/**
 * Update human review status on a compliance record
 */
export async function updateRecordReviewStatus(
  baseUrl: string,
  recordId: string,
  reviewStatus: ReviewStatus,
  notes?: string
): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, '')}/records/${encodeURIComponent(recordId)}/review`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status: reviewStatus, review_notes: notes }),
  });
  if (!resp.ok) {
    throw new ApiError(`Failed to update review status: ${resp.statusText}`, resp.status);
  }
}

/**
 * Delete a compliance record
 */
export async function deleteBackendRecord(baseUrl: string, recordId: string): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, '')}/records/${encodeURIComponent(recordId)}`;
  const resp = await fetch(url, { method: 'DELETE' });
  if (!resp.ok) {
    throw new ApiError(`Failed to delete record: ${resp.statusText}`, resp.status);
  }
}

/**
 * Fetch developer diagnostics from the backend
 */
export async function fetchDiagnostics(baseUrl: string): Promise<Record<string, any>> {
  const url = `${baseUrl.replace(/\/+$/, '')}/diagnostics`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new ApiError(`Failed to fetch diagnostics: ${resp.statusText}`, resp.status);
  }
  return await resp.json();
}
