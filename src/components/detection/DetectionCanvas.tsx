import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DetectionItem, DetectionClass } from '@/types/detection';
import { drawDetectionsOnCanvas } from '@/utils/canvasDrawer';

interface DetectionCanvasProps {
  imageUrl: string;
  detections: DetectionItem[];
  highlightedId?: string | null;
  selectedId?: string | null;
  onSelectDetection?: (id: string | null) => void;
  activeFilterClass?: DetectionClass | 'all';
  showLabels?: boolean;
  showConfidence?: boolean;
  boxThickness?: number;
  boxOpacity?: number;
}

export const DetectionCanvas: React.FC<DetectionCanvasProps> = ({
  imageUrl,
  detections,
  highlightedId = null,
  selectedId = null,
  onSelectDetection,
  activeFilterClass = 'all',
  showLabels = true,
  showConfidence = true,
  boxThickness = 2,
  boxOpacity = 0.85,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Load Image Object
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      imageRef.current = img;
      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };

    return () => {
      imageRef.current = null;
    };
  }, [imageUrl]);

  // Render canvas with proper scaling
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal resolution matching natural image size for crisp rendering
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw original image onto canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw detection overlays
    drawDetectionsOnCanvas(ctx, detections, canvas.width, canvas.height, {
      highlightedId,
      selectedId,
      showLabels,
      showConfidence,
      boxThickness,
      boxOpacity,
      activeFilterClass,
    });
  }, [
    imageLoaded,
    detections,
    highlightedId,
    selectedId,
    showLabels,
    showConfidence,
    boxThickness,
    boxOpacity,
    activeFilterClass,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle click on canvas to select corresponding detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectDetection || !canvasRef.current || !naturalDimensions.width) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = naturalDimensions.width / rect.width;
    const scaleY = naturalDimensions.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find the smallest box containing click (or first match)
    let matchedId: string | null = null;
    let minArea = Infinity;

    for (const det of detections) {
      if (activeFilterClass !== 'all' && det.class_name !== activeFilterClass) continue;

      const [x1, y1, x2, y2] = det.bbox;
      if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
        const area = (x2 - x1) * (y2 - y1);
        if (area < minArea) {
          minArea = area;
          matchedId = det.id || null;
        }
      }
    }

    onSelectDetection(matchedId === selectedId ? null : matchedId);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center bg-black/60 rounded-lg overflow-hidden border border-border-subtle"
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-card/50 text-text-secondary text-xs">
          Loading image and bounding boxes...
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-auto max-h-[580px] object-contain cursor-crosshair select-none"
        title="Click on a detection box to inspect it"
      />
    </div>
  );
};
