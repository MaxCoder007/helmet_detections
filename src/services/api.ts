import { HealthStatus, PredictionResult } from '@/types/detection';

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
      model_name: data.model_name || data.model || 'YOLO11n',
      device: data.device || 'CPU',
      classes: data.classes || ['helmet', 'no_helmet', 'number_plate', 'pillion', 'rider'],
      latency_ms: latency,
      lastChecked: Date.now(),
    };
  } catch (err: unknown) {
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
  conf?: number;
  iou?: number;
  imgsz?: number;
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
  if (options.conf !== undefined) queryParams.append('conf', String(options.conf));
  if (options.iou !== undefined) queryParams.append('iou', String(options.iou));
  if (options.imgsz !== undefined) queryParams.append('imgsz', String(options.imgsz));

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
    let rawBbox = d.bbox;
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    if (Array.isArray(rawBbox) && rawBbox.length === 4) {
      [x1, y1, x2, y2] = rawBbox.map(Number);
    }

    return {
      id: `det-${idx + 1}-${Date.now()}`,
      class_id: Number(d.class_id ?? 0),
      class_name: String(d.class_name ?? 'unknown'),
      confidence: Number(d.confidence ?? 0),
      bbox: [x1, y1, x2, y2] as [number, number, number, number],
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

  return {
    success: Boolean(data.success ?? true),
    filename: String(data.filename ?? 'image.jpg'),
    inference_time_ms: Number(data.inference_time_ms ?? 0),
    image_width: Number(data.image_width ?? 0),
    image_height: Number(data.image_height ?? 0),
    annotated_image_url: annotatedUrl,
    annotated_image_base64: typeof data.annotated_image_base64 === 'string' ? data.annotated_image_base64 : undefined,
    detections: normalizedDetections,
    counts: normalizedCounts,
    is_demo: false,
  };
}
