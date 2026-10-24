import { DetectionItem, DetectionClass } from '@/types/detection';
import { DETECTION_CLASSES } from '@/utils/constants';
import { formatConfidence } from '@/utils/formatters';

export interface DrawOptions {
  highlightedId?: string | null;
  selectedId?: string | null;
  showLabels?: boolean;
  showConfidence?: boolean;
  boxThickness?: number;
  boxOpacity?: number;
  activeFilterClass?: DetectionClass | 'all';
}

/**
 * Draw detections onto an HTML canvas element
 */
export function drawDetectionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  detections: DetectionItem[],
  imageWidth: number,
  _imageHeight: number,
  options: DrawOptions = {}
): void {
  const {
    highlightedId = null,
    selectedId = null,
    showLabels = true,
    showConfidence = true,
    boxThickness = 2,
    boxOpacity = 0.85,
    activeFilterClass = 'all',
  } = options;

  detections.forEach((detection) => {
    // Check if filtered out
    if (activeFilterClass !== 'all' && detection.class_name !== activeFilterClass) {
      return;
    }

    const [x1, y1, x2, y2] = detection.bbox;
    const boxW = Math.max(0, x2 - x1);
    const boxH = Math.max(0, y2 - y1);

    const classConfig = DETECTION_CLASSES[detection.class_name as DetectionClass] || {
      name: detection.class_name,
      displayName: detection.class_name,
      color: '#8BE8FF',
      bgRgba: 'rgba(139, 232, 255, 0.15)',
    };

    const isHighlighted = detection.id === highlightedId || detection.id === selectedId;

    ctx.save();

    // 1. Box outline
    ctx.lineWidth = isHighlighted ? boxThickness + 2 : boxThickness;
    ctx.strokeStyle = classConfig.color;
    ctx.globalAlpha = isHighlighted ? 1.0 : boxOpacity;

    // Outer glow for highlighted boxes
    if (isHighlighted) {
      ctx.shadowColor = classConfig.color;
      ctx.shadowBlur = 12;
    }

    ctx.strokeRect(x1, y1, boxW, boxH);

    // 2. Subtle fill
    ctx.fillStyle = classConfig.color;
    ctx.globalAlpha = isHighlighted ? 0.25 : 0.08;
    ctx.fillRect(x1, y1, boxW, boxH);

    // Reset shadow
    ctx.shadowBlur = 0;

    // 3. Label tag
    if (showLabels) {
      const labelText = showConfidence
        ? `${classConfig.displayName} ${formatConfidence(detection.confidence)}`
        : classConfig.displayName;

      ctx.font = `600 ${Math.max(12, Math.min(18, Math.round(imageWidth * 0.016)))}px Inter, sans-serif`;
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = parseInt(ctx.font, 10);
      const paddingX = 8;
      const paddingY = 4;
      const tagHeight = textHeight + paddingY * 2;
      const tagWidth = textWidth + paddingX * 2;

      // Position tag above box, or inside if near top
      let tagY = y1 - tagHeight;
      if (tagY < 0) {
        tagY = y1;
      }
      const tagX = Math.min(x1, Math.max(0, imageWidth - tagWidth));

      // Tag Background
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = classConfig.color;
      ctx.beginPath();
      // Round top corners or entire pill
      ctx.roundRect ? ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 4) : ctx.rect(tagX, tagY, tagWidth, tagHeight);
      ctx.fill();

      // Tag Text
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#09090B'; // Dark text for contrast on colored pill
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, tagX + paddingX, tagY + tagHeight / 2);
    }

    ctx.restore();
  });
}

/**
 * Render image with bounding box overlays and return as a downloadable Blob
 */
export async function exportAnnotatedImageBlob(
  imageElement: HTMLImageElement,
  detections: DetectionItem[],
  options: DrawOptions = {}
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.naturalWidth || imageElement.width;
  canvas.height = imageElement.naturalHeight || imageElement.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Draw original image
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  // Draw detections
  drawDetectionsOnCanvas(ctx, detections, canvas.width, canvas.height, {
    ...options,
    boxThickness: Math.max(3, Math.round(canvas.width / 400)),
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create image blob from canvas'));
      }
    }, 'image/jpeg', 0.95);
  });
}
