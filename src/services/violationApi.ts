import {
  ViolationRecord,
  ViolationListResponse,
  ViolationQueryParams,
  ViolationReviewStatus,
} from '@/types/violation';
import { ApiError } from './api';

export function getEvidenceUrl(
  baseUrl: string,
  violationId: string,
  evidenceType: 'original' | 'rider' | 'number_plate'
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/api/violations/${encodeURIComponent(violationId)}/evidence/${evidenceType}`;
}

export async function fetchViolations(
  baseUrl: string,
  params: ViolationQueryParams = {}
): Promise<ViolationListResponse> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.append('limit', String(params.limit));
  if (params.offset !== undefined) query.append('offset', String(params.offset));
  if (params.registration) query.append('registration', params.registration);
  if (params.ocr_status && params.ocr_status !== 'all') query.append('ocr_status', params.ocr_status);
  if (params.review_status && params.review_status !== 'all') query.append('review_status', params.review_status);
  if (params.association_status && params.association_status !== 'all') {
    query.append('association_status', params.association_status);
  }
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.violation_type && params.violation_type !== 'all') {
    query.append('violation_type', params.violation_type);
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/api/violations?${query.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new ApiError(`Failed to fetch violations: ${resp.statusText}`, resp.status);
  }
  return await resp.json();
}

export async function fetchSingleViolation(
  baseUrl: string,
  violationId: string
): Promise<ViolationRecord> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/api/violations/${encodeURIComponent(violationId)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new ApiError(`Failed to fetch violation: ${resp.statusText}`, resp.status);
  }
  return await resp.json();
}

export async function updateViolationReview(
  baseUrl: string,
  violationId: string,
  payload: {
    review_status?: ViolationReviewStatus;
    manual_registration_number?: string | null;
    review_notes?: string | null;
  }
): Promise<ViolationRecord> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/api/violations/${encodeURIComponent(violationId)}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new ApiError(`Failed to update violation review: ${resp.statusText}`, resp.status);
  }
  const data = await resp.json();
  return data.record;
}
