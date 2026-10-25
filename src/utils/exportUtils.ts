import { ViolationRecord } from '@/types/violation';
import { ComplianceRecord, DetectionItem, PredictionResult } from '@/types/detection';

/**
 * Trigger browser file download from Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export arbitrary data object as formatted JSON file
 */
export function exportToJson(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Export rows array as RFC-4180 compliant CSV file
 */
export function exportToCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, any>[],
  filename: string
): void {
  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((col) => escapeCell(col.label)).join(',');
  const rowLines = rows.map((row) =>
    columns.map((col) => escapeCell(row[col.key])).join(',')
  );
  const csvContent = [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Standard CSV columns for Number Plate Violation records
 */
export const VIOLATION_CSV_COLUMNS = [
  { key: 'id', label: 'Violation ID' },
  { key: 'violation_timestamp', label: 'Timestamp' },
  { key: 'registration_number', label: 'OCR Registration' },
  { key: 'manual_registration_number', label: 'Manual Registration' },
  { key: 'effective_registration', label: 'Effective Registration' },
  { key: 'ocr_status', label: 'OCR Status' },
  { key: 'ocr_confidence', label: 'OCR Confidence' },
  { key: 'plate_detection_confidence', label: 'Plate Detection Conf' },
  { key: 'violation_type', label: 'Violation Type' },
  { key: 'vehicle_association_status', label: 'Vehicle Association' },
  { key: 'review_status', label: 'Review Status' },
  { key: 'review_notes', label: 'Review Notes' },
  { key: 'reviewed_at', label: 'Reviewed At' },
  { key: 'source_type', label: 'Source Type' },
  { key: 'source_reference', label: 'Source Reference' },
  { key: 'rider_bbox', label: 'Rider BBox' },
  { key: 'plate_bbox', label: 'Plate BBox' },
  { key: 'helmet_bbox', label: 'Helmet BBox' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created At' },
];

/**
 * Download a single violation record as JSON dossier or CSV
 */
export function downloadViolationRecord(
  violation: ViolationRecord,
  format: 'json' | 'csv' = 'json'
): void {
  const regTag = violation.manual_registration_number || violation.registration_number || 'UNIDENTIFIED';
  const cleanTag = regTag.replace(/[^A-Za-z0-9_-]/g, '_');
  const filename = `violation_${cleanTag}_${violation.id}.${format}`;

  if (format === 'csv') {
    const effective = violation.manual_registration_number || violation.registration_number || '';
    const row = {
      ...violation,
      effective_registration: effective,
      rider_bbox: violation.rider_bbox ? JSON.stringify(violation.rider_bbox) : '',
      plate_bbox: violation.plate_bbox ? JSON.stringify(violation.plate_bbox) : '',
      helmet_bbox: violation.helmet_bbox ? JSON.stringify(violation.helmet_bbox) : '',
    };
    exportToCsv(VIOLATION_CSV_COLUMNS, [row], filename);
  } else {
    const dossier = {
      dossier_type: 'roadvision_violation_evidence_record',
      exported_at: new Date().toISOString(),
      violation,
    };
    exportToJson(dossier, filename);
  }
}

/**
 * Download all violation records as CSV or JSON
 */
export function downloadAllViolations(
  violations: ViolationRecord[],
  format: 'csv' | 'json' = 'csv',
  filenamePrefix = 'roadvision_violations'
): void {
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenamePrefix}_${nowStr}.${format}`;

  if (format === 'csv') {
    const rows = violations.map((v) => ({
      ...v,
      effective_registration: v.manual_registration_number || v.registration_number || '',
      rider_bbox: v.rider_bbox ? JSON.stringify(v.rider_bbox) : '',
      plate_bbox: v.plate_bbox ? JSON.stringify(v.plate_bbox) : '',
      helmet_bbox: v.helmet_bbox ? JSON.stringify(v.helmet_bbox) : '',
    }));
    exportToCsv(VIOLATION_CSV_COLUMNS, rows, filename);
  } else {
    const payload = {
      exported_at: new Date().toISOString(),
      total_records: violations.length,
      records: violations,
    };
    exportToJson(payload, filename);
  }
}

/**
 * Download an individual compliance record
 */
export function downloadComplianceRecord(
  record: ComplianceRecord,
  format: 'json' | 'csv' = 'json'
): void {
  const regTag = record.registration_number || 'UNREADABLE';
  const cleanTag = regTag.replace(/[^A-Za-z0-9_-]/g, '_');
  const filename = `compliance_${cleanTag}_${record.id}.${format}`;

  if (format === 'csv') {
    const columns = [
      { key: 'id', label: 'Record ID' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'registration_number', label: 'Registration Number' },
      { key: 'ocr_status', label: 'OCR Status' },
      { key: 'ocr_confidence', label: 'OCR Confidence' },
      { key: 'raw_ocr_text', label: 'Raw OCR' },
      { key: 'helmet_status', label: 'Helmet Status' },
      { key: 'helmet_confidence', label: 'Helmet Confidence' },
      { key: 'association_status', label: 'Association Status' },
      { key: 'violation_candidate', label: 'Violation Candidate' },
      { key: 'review_required', label: 'Review Required' },
      { key: 'review_status', label: 'Review Status' },
      { key: 'review_notes', label: 'Review Notes' },
      { key: 'filename', label: 'Filename' },
    ];
    exportToCsv(columns, [record as any], filename);
  } else {
    exportToJson({ exported_at: new Date().toISOString(), compliance_record: record }, filename);
  }
}

/**
 * Download a full analysis result (detections + compliance + counts + performance)
 */
export function downloadAnalysisResult(
  result: PredictionResult,
  baseFilename = 'analysis_result',
  format: 'json' | 'csv' = 'json'
): void {
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${baseFilename}_${nowStr}.${format}`;

  if (format === 'csv') {
    // Export detections as CSV
    const columns = [
      { key: 'id', label: 'Detection ID' },
      { key: 'class_name', label: 'Class Name' },
      { key: 'confidence', label: 'Confidence' },
      { key: 'x1', label: 'BBox X1' },
      { key: 'y1', label: 'BBox Y1' },
      { key: 'x2', label: 'BBox X2' },
      { key: 'y2', label: 'BBox Y2' },
      { key: 'ocr_text', label: 'Plate OCR' },
      { key: 'ocr_confidence', label: 'OCR Conf' },
      { key: 'quality_status', label: 'Quality' },
    ];
    const rows = result.detections.map((d: DetectionItem, idx: number) => ({
      id: d.id || `det_${idx}`,
      class_name: d.class_name,
      confidence: d.confidence,
      x1: d.bbox[0],
      y1: d.bbox[1],
      x2: d.bbox[2],
      y2: d.bbox[3],
      ocr_text: d.ocr?.text || '',
      ocr_confidence: d.ocr?.confidence ?? '',
      quality_status: d.quality_status || 'normal',
    }));
    exportToCsv(columns, rows, filename);
  } else {
    exportToJson({
      exported_at: new Date().toISOString(),
      analysis: result,
    }, filename);
  }
}
