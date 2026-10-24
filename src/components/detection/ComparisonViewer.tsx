import React, { useState } from 'react';
import { PredictionResult, DetectionClass } from '@/types/detection';
import { DetectionCanvas } from './DetectionCanvas';
import { Button } from '@/components/ui/Button';
import { exportAnnotatedImageBlob } from '@/utils/canvasDrawer';
import {
  Download,
  Layers,
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
  highlightedId: string | null;
  selectedId: string | null;
  onSelectDetection: (id: string | null) => void;
  activeFilterClass?: DetectionClass | 'all';
}

type ViewMode = 'overlay' | 'annotated' | 'original' | 'split';

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  originalUrl,
  result,
  highlightedId,
  selectedId,
  onSelectDetection,
  activeFilterClass = 'all',
}) => {
  const { settings } = useDetection();
  const [viewMode, setViewMode] = useState<ViewMode>('overlay');
  const [showLabels, setShowLabels] = useState(settings.showLabels);
  const [showConfidence, setShowConfidence] = useState(settings.showConfidence);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // If backend provided an annotated image URL or base64
  const hasBackendAnnotatedImage = Boolean(
    result.annotated_image_url || result.annotated_image_base64
  );
  const backendAnnotatedSrc =
    result.annotated_image_base64
      ? `data:image/jpeg;base64,${result.annotated_image_base64}`
      : result.annotated_image_url;

  // Download logic
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (backendAnnotatedSrc && viewMode === 'annotated') {
        // Download directly from backend URL
        const a = document.createElement('a');
        a.href = backendAnnotatedSrc!;
        a.download = `roadvision_${result.filename.replace(/\.[^/.]+$/, '')}_annotated.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Export high-res canvas render
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = originalUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const blob = await exportAnnotatedImageBlob(img, result.detections, {
          showLabels,
          showConfidence,
          activeFilterClass,
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadvision_${result.filename.replace(/\.[^/.]+$/, '')}_annotated.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
            onClick={() => setViewMode('overlay')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
              viewMode === 'overlay'
                ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
            title="Interactive bounding boxes with hover inspections"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Canvas</span>
          </button>

          {hasBackendAnnotatedImage && (
            <button
              onClick={() => setViewMode('annotated')}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
                viewMode === 'annotated'
                  ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              )}
              title="Annotated image rendered by backend model"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Backend Render</span>
            </button>
          )}

          <button
            onClick={() => setViewMode('original')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5',
              viewMode === 'original'
                ? 'bg-accent-cyan text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
            title="Clean original image without boxes"
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

        {/* Right side controls: Labels toggle & Download */}
        <div className="flex items-center gap-2">
          {viewMode === 'overlay' && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-background-secondary rounded-lg border border-border text-xs text-text-secondary">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary select-none">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded bg-background border-border text-accent-cyan focus:ring-accent-cyan/30"
                />
                <span>Labels</span>
              </label>

              <span className="text-text-muted">•</span>

              <label className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary select-none">
                <input
                  type="checkbox"
                  checked={showConfidence}
                  onChange={(e) => setShowConfidence(e.target.checked)}
                  className="rounded bg-background border-border text-accent-cyan focus:ring-accent-cyan/30"
                />
                <span>Scores</span>
              </label>
            </div>
          )}

          {/* Download Button */}
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
            <span>{downloadSuccess ? 'Downloaded' : 'Download Result'}</span>
          </Button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="relative min-h-[380px] flex items-center justify-center">
        {viewMode === 'overlay' && (
          <DetectionCanvas
            imageUrl={originalUrl}
            detections={result.detections}
            highlightedId={highlightedId}
            selectedId={selectedId}
            onSelectDetection={onSelectDetection}
            activeFilterClass={activeFilterClass}
            showLabels={showLabels}
            showConfidence={showConfidence}
            boxThickness={settings.boxThickness}
            boxOpacity={settings.boxOpacity}
          />
        )}

        {viewMode === 'annotated' && backendAnnotatedSrc && (
          <div className="relative w-full flex items-center justify-center bg-black/60 rounded-lg overflow-hidden border border-border-subtle">
            <img
              src={backendAnnotatedSrc}
              alt="Backend Annotated Result"
              className="w-full h-auto max-h-[580px] object-contain select-none"
            />
          </div>
        )}

        {viewMode === 'original' && (
          <div className="relative w-full flex items-center justify-center bg-black/60 rounded-lg overflow-hidden border border-border-subtle">
            <img
              src={originalUrl}
              alt="Original Unprocessed Image"
              className="w-full h-auto max-h-[580px] object-contain select-none"
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
              <div className="bg-black/60 rounded flex items-center justify-center overflow-hidden max-h-[400px]">
                <img
                  src={originalUrl}
                  alt="Original"
                  className="w-full h-auto max-h-[380px] object-contain"
                />
              </div>
            </div>

            {/* Detections Card */}
            <div className="bg-background-secondary rounded-lg p-2 border border-border">
              <div className="text-[11px] font-semibold text-accent-cyan mb-1.5 flex items-center justify-between">
                <span>Detections ({result.detections.length} objects)</span>
                <span className="text-text-muted font-mono">{result.inference_time_ms} ms</span>
              </div>
              <DetectionCanvas
                imageUrl={originalUrl}
                detections={result.detections}
                highlightedId={highlightedId}
                selectedId={selectedId}
                onSelectDetection={onSelectDetection}
                activeFilterClass={activeFilterClass}
                showLabels={showLabels}
                showConfidence={showConfidence}
                boxThickness={settings.boxThickness}
                boxOpacity={settings.boxOpacity}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
