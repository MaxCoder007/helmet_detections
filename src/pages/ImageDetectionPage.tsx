import React, { useState } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { ImageDropzone } from '@/components/upload/ImageDropzone';
import { ImagePreview } from '@/components/upload/ImagePreview';
import { ComparisonViewer } from '@/components/detection/ComparisonViewer';
import { DetectionSummary } from '@/components/detection/DetectionSummary';
import { DetectionTable } from '@/components/detection/DetectionTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetectionClass } from '@/types/detection';
import { formatDuration } from '@/utils/formatters';
import {
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ImageDetectionPage: React.FC = () => {
  const {
    activeFile,
    activePreviewUrl,
    activeResult,
    status,
    errorMessage,
    highlightedDetectionId,
    setActiveImage,
    clearActiveImage,
    runActiveAnalysis,
    cancelAnalysis,
    setHighlightedDetectionId,
    settings,
    health,
  } = useDetection();

  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [activeFilterClass, setActiveFilterClass] = useState<DetectionClass | 'all'>('all');

  const isAnalyzing = status === 'analyzing';
  const hasResult = status === 'success' && activeResult !== null;

  const handleReset = () => {
    clearActiveImage();
    setSelectedDetectionId(null);
    setActiveFilterClass('all');
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Image Detection Workspace
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Detect helmets, violations, license plates, riders, and pillions using YOLO11n
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activePreviewUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isAnalyzing}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={runActiveAnalysis}
            disabled={!activePreviewUrl || isAnalyzing}
            isLoading={isAnalyzing}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            {isAnalyzing ? 'Analyzing Image...' : 'Analyze Image'}
          </Button>

          {isAnalyzing && (
            <Button variant="danger" size="md" onClick={cancelAnalysis}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Backend Offline / Demo Banner Alert */}
      {health.status === 'offline' && !settings.demoMode && (
        <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-text-primary mb-1">
              Backend Server is Currently Offline
            </h4>
            <p className="text-status-error/90 leading-relaxed">
              The application could not establish a connection to FastAPI at{' '}
              <code className="bg-background/80 px-1.5 py-0.5 rounded font-mono text-text-primary">
                {settings.apiBaseUrl}
              </code>
              . Start your backend or switch on <strong>Demo Mode</strong> in Settings to test predictions.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link to="/settings">
                <Button size="sm" variant="danger">
                  Open Settings & Demo Mode
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Demo Mode Notice */}
      {settings.demoMode && (
        <div className="p-3 rounded-xl bg-accent-pink/10 border border-accent-pink/30 text-xs text-accent-pink flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
            <span>
              <strong>Demo Mode Enabled:</strong> The workspace will generate simulated YOLO11n predictions for interface demonstration.
            </span>
          </div>
          <Link to="/settings" className="underline hover:text-white text-[11px]">
            Disable Demo Mode
          </Link>
        </div>
      )}

      {/* Main Workspace Layout */}
      {!activePreviewUrl ? (
        /* Upload Area when no image is loaded */
        <Card className="border-border">
          <ImageDropzone onFileSelect={setActiveImage} disabled={isAnalyzing} />
        </Card>
      ) : (
        /* Image Preview & Results Area */
        <div className="space-y-6">
          {/* Analysis In-Progress Banner */}
          {isAnalyzing && (
            <div className="p-4 rounded-xl bg-background-card border border-accent-cyan/30 flex items-center justify-between shadow-glow-cyan/20">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">
                    Running YOLO11n Inference...
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Pre-processing letterbox (640×640), evaluating neural network layers, extracting detections
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Display */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-text-primary mb-0.5">Inference Failed</h4>
                <p className="text-status-error/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Results Workspace: Activated once inference completes */}
          {hasResult && activeResult ? (
            <div className="space-y-6">
              {/* Summary Stats Header Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-background-card border border-border rounded-xl p-3">
                  <span className="text-[11px] text-text-secondary">Total Objects</span>
                  <div className="font-mono text-xl font-bold text-text-primary mt-1">
                    {activeResult.detections.length}
                  </div>
                </div>

                <div className="bg-background-card border border-border rounded-xl p-3">
                  <span className="text-[11px] text-text-secondary">Inference Latency</span>
                  <div className="font-mono text-xl font-bold text-accent-cyan mt-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-accent-cyan" />
                    <span>{formatDuration(activeResult.inference_time_ms)}</span>
                  </div>
                </div>

                <div className="bg-background-card border border-border rounded-xl p-3">
                  <span className="text-[11px] text-text-secondary">Image Resolution</span>
                  <div className="font-mono text-xl font-bold text-text-primary mt-1">
                    {activeResult.image_width && activeResult.image_height
                      ? `${activeResult.image_width}×${activeResult.image_height}`
                      : 'Loaded'}
                  </div>
                </div>

                <div className="bg-background-card border border-border rounded-xl p-3">
                  <span className="text-[11px] text-text-secondary">Violations (No Helmet)</span>
                  <div
                    className={`font-mono text-xl font-bold mt-1 ${
                      activeResult.counts.no_helmet > 0
                        ? 'text-status-error'
                        : 'text-status-success'
                    }`}
                  >
                    {activeResult.counts.no_helmet}
                  </div>
                </div>
              </div>

              {/* Class Summary Breakdown with interactive filtering */}
              <DetectionSummary
                counts={activeResult.counts}
                totalDetections={activeResult.detections.length}
                activeFilter={activeFilterClass}
                onFilterChange={setActiveFilterClass}
              />

              {/* Comparison & Canvas Visualization Viewport */}
              <ComparisonViewer
                originalUrl={activePreviewUrl}
                result={activeResult}
                highlightedId={highlightedDetectionId}
                selectedId={selectedDetectionId}
                onSelectDetection={setSelectedDetectionId}
                activeFilterClass={activeFilterClass}
              />

              {/* Detection Results Table */}
              <DetectionTable
                detections={activeResult.detections}
                highlightedId={highlightedDetectionId}
                selectedId={selectedDetectionId}
                onHoverDetection={setHighlightedDetectionId}
                onSelectDetection={setSelectedDetectionId}
                activeFilterClass={activeFilterClass}
              />
            </div>
          ) : (
            /* Selected Image Preview before inference */
            <div className="space-y-4">
              <ImagePreview
                file={activeFile}
                previewUrl={activePreviewUrl}
                onRemove={handleReset}
                onReplace={setActiveImage}
                disabled={isAnalyzing}
              />

              <div className="bg-background-card border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-text-secondary">
                  Ready to analyze with YOLO11n. Click the button to send the image for inference.
                </span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={runActiveAnalysis}
                  disabled={isAnalyzing}
                  isLoading={isAnalyzing}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Analyze Image
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
