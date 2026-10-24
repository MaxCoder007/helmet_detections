import { ClassCounts, DetectionItem } from '@/types/detection';

/**
 * Format bytes into human-readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format confidence float (0.0 - 1.0) into a readable percentage string
 */
export function formatConfidence(conf: number): string {
  if (isNaN(conf)) return '0.0%';
  const clamped = Math.max(0, Math.min(1, conf));
  return `${(clamped * 100).toFixed(1)}%`;
}

/**
 * Format bounding box coordinates into clean string
 */
export function formatBBox(bbox: [number, number, number, number]): string {
  const [x1, y1, x2, y2] = bbox.map(Math.round);
  return `[${x1}, ${y1}, ${x2}, ${y2}]`;
}

/**
 * Format timestamp into readable time string
 */
export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Sanitize filename for safe display
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Calculate compliance rate from counts
 * Compliance = Helmets / (Helmets + No_Helmets) * 100
 */
export function calculateComplianceRate(counts: ClassCounts): number | null {
  const helmet = counts.helmet || 0;
  const noHelmet = counts.no_helmet || 0;
  const total = helmet + noHelmet;
  if (total === 0) return null;
  return Math.round((helmet / total) * 100);
}

/**
 * Generate a sorted detection list
 */
export function sortDetections(
  detections: DetectionItem[],
  sortBy: 'confidence' | 'class' | 'area',
  direction: 'asc' | 'desc' = 'desc'
): DetectionItem[] {
  return [...detections].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'confidence') {
      comparison = a.confidence - b.confidence;
    } else if (sortBy === 'class') {
      comparison = a.class_name.localeCompare(b.class_name);
    } else if (sortBy === 'area') {
      const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
      const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
      comparison = areaA - areaB;
    }
    return direction === 'desc' ? -comparison : comparison;
  });
}
