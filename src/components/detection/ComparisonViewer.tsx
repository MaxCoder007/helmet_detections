import React, { useState, useEffect } from 'react';
import { PredictionResult, DetectionClass } from '@/types/detection';
import { Button } from '@/components/ui/Button';
import { exportAnnotatedImageBlob } from '@/utils/canvasDrawer';
import {
  Download,
  Image as ImageIcon,
  Columns,
  Eye,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDetection } from '@/context/DetectionContext';

interface ComparisonViewerProps {
  originalUrl: string;
  result: PredictionResult;
  highlightedId?: string | null;
  selectedId?: string | null;
  onSelectDetection?: (id: string | null) => void;
  activeFilterClass?: DetectionClass | 'all';
  onDimensionsUpdate?: (dims: {
    naturalWidth: number;
    naturalHeight: number;
    clientWidth: number;
    clientHeight: number;
  }) => void;
}

type ViewMode = 'annotated' | 'original' | 'split';

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  originalUrl,
  result,
  activeFilterClass = 'all',
  onDimensionsUpdate,
}) => {
  const { settings } = useDetection();
  const [viewMode, setViewMode] = useState<ViewMode>('annotated');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [fallbackAnnotatedSrc, setFallbackAnnotatedSrc] = useState<string | null>(null);

  // Direct backend annotated image URL or base64
  const backendAnnotatedSrc =
    result.annotated_image_base64
      ? `data:image/jpeg;base64,${result.annotated_image_base64}`
      : result.annotated_image_url;

  // If backend did not supply an annotated image URL (e.g. demo mode), generate a static image fallback
  useEffect(() => {
    if (!backendAnnotatedSrc && originalUrl && result.detections.length > 0) {
      let active = true;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = originalUrl;
      img.onload = async () => {
        try {
          const blob = await exportAnnotatedImageBlob(img, result.detections, {
            showLabels: settings.showLabels,
            showConfidence: settings.showConfidence,
            activeFilterClass,
          });
          if (active) {
            setFallbackAnnotatedSrc(URL.createObjectURL(blob));
          }
        } catch (e) {
          console.warn('Fallback annotated image generation error:', e);
        }
      };
      return () => {
        active = false;
      };
    }
  }, [backendAnnotatedSrc, originalUrl, result.detections, activeFilterClass, settings.showLabels, settings.showConfidence]);

  const effectiveAnnotatedSrc = backendAnnotatedSrc || fallbackAnnotatedSrc || originalUrl;

  // Download logic for the current view
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const srcToDownload = viewMode === 'original' ? originalUrl : effectiveAnnotatedSrc;
      if (!srcToDownload) return;

      const filenameSuffix = viewMode === 'original' ? 'original' : 'annotated';
      const downloadFilename = `roadvision_${result.filename.replace(/\.[^/.]+$/, '')}_${filenameSuffix}.jpg`;

      // Try fetching as blob for direct download prompt
      try {
        const res = await fetch(srcToDownload);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Fallback to direct anchor link
        const a = document.createElement('a');
        a.href = srcToDownload;
        a.download = downloadFilename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-background-card border border-border rounded-xl p-4 flex flex-col gap-4">
      {/* Viewer Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-background-secondary p-1 rounded-lg border border-border">
          <button
            onClick={() => setViewMode('annotated')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
              viewMode === 'annotated'
                ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
            title="Model annotated image showing detected riders, helmets, and number plates"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Annotated Image</span>
          </button>

          <button
            onClick={() => setViewMode('original')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
              viewMode === 'original'
                ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
            title="Clean original image without bounding boxes"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Original</span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
              viewMode === 'split'
                ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
            title="Side-by-side original and detection comparison"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Side-by-Side</span>
          </button>
        </div>

        {/* Right side controls: Download Button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            isLoading={isDownloading}
            leftIcon={
              downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-status-success" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )
            }
          >
            <span>{downloadSuccess ? 'Downloaded' : 'Download Image'}</span>
          </Button>
        </div>
      </div>

      {/* Main Image Viewport (Clean <img> rendering, No interactive canvas) */}
      <div className="relative min-h-[380px] flex items-center justify-center">
        {viewMode === 'annotated' && (
          <div className="relative w-full flex items-center justify-center bg-black/60 rounded-lg overflow-hidden border border-border-subtle p-2">
            <img
              src={effectiveAnnotatedSrc}
              alt="Annotated Detection Result"
              className="w-full h-auto max-h-[640px] object-contain select-none rounded"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (onDimensionsUpdate) {
                  onDimensionsUpdate({
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    clientWidth: img.clientWidth,
                    clientHeight: img.clientHeight,
                  });
                }
              }}
            />
          </div>
        )}

        {viewMode === 'original' && (
          <div className="relative w-full flex items-center justify-center bg-black/60 rounded-lg overflow-hidden border border-border-subtle p-2">
            <img
              src={originalUrl}
              alt="Original Unprocessed Image"
              className="w-full h-auto max-h-[640px] object-contain select-none rounded"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (onDimensionsUpdate) {
                  onDimensionsUpdate({
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    clientWidth: img.clientWidth,
                    clientHeight: img.clientHeight,
                  });
                }
              }}
            />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
            {/* Original Card */}
            <div className="bg-background-secondary rounded-lg p-2 border border-border">
              <div className="text-[11px] font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
                <span>Original Image</span>
                <span className="text-text-muted">Unprocessed</span>
              </div>
              <div className="bg-black/60 rounded flex items-center justify-center overflow-hidden max-h-[460px] p-1">
                <img
                  src={originalUrl}
                  alt="Original"
                  className="w-full h-auto max-h-[440px] object-contain select-none rounded"
                />
              </div>
            </div>

            {/* Detections Card */}
            <div className="bg-background-secondary rounded-lg p-2 border border-border">
              <div className="text-[11px] font-semibold text-accent-cyan mb-1.5 flex items-center justify-between">
                <span>Annotated Detections ({result.detections.length} objects)</span>
                <span className="text-text-muted font-mono">{result.inference_time_ms} ms</span>
              </div>
              <div className="bg-black/60 rounded flex items-center justify-center overflow-hidden max-h-[460px] p-1">
                <img
                  src={effectiveAnnotatedSrc}
                  alt="Annotated Detections"
                  className="w-full h-auto max-h-[440px] object-contain select-none rounded"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
