import React, { useState } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { ImageDropzone } from '@/components/upload/ImageDropzone';
import { ImagePreview } from '@/components/upload/ImagePreview';
import { ComparisonViewer } from '@/components/detection/ComparisonViewer';
import { DetectionSummary } from '@/components/detection/DetectionSummary';
import { DetectionTable } from '@/components/detection/DetectionTable';
import { ComplianceTable } from '@/components/compliance/ComplianceTable';
import { DiagnosticsPanel } from '@/components/detection/DiagnosticsPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetectionClass, ReviewStatus } from '@/types/detection';
import { updateRecordReviewStatus } from '@/services/api';
import { formatDuration, formatConfidence } from '@/utils/formatters';
import {
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Clock,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import { downloadAnalysisResult } from '@/utils/exportUtils';

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
    updateSettings,
    health,
  } = useDetection();

  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [activeFilterClass, setActiveFilterClass] = useState<DetectionClass | 'all'>('all');
  const [resultTab, setResultTab] = useState<'detections' | 'compliance'>('detections');
  const [showSettings, setShowSettings] = useState(false);
  const [frontendDims, setFrontendDims] = useState<{
    naturalWidth: number;
    naturalHeight: number;
    clientWidth: number;
    clientHeight: number;
  }>({ naturalWidth: 0, naturalHeight: 0, clientWidth: 0, clientHeight: 0 });

  const isAnalyzing = status === 'analyzing';
  const hasResult = status === 'success' && activeResult !== null;

  // Display every detection returned by YOLO after duplicate suppression and helmet conflict resolution
  const displayedDetections = activeResult?.detections || [];

  const handleReset = () => {
    clearActiveImage();
    setSelectedDetectionId(null);
    setActiveFilterClass('all');
  };

  const handleAnalyzeClick = () => {
    setActiveFilterClass('all');
    setSelectedDetectionId(null);
    setResultTab('detections');
    runActiveAnalysis();
  };

  const handleUpdateReview = async (recordId: string, reviewStatus: ReviewStatus, notes?: string) => {
    try {
      if (!settings.demoMode && health.status === 'ok') {
        await updateRecordReviewStatus(settings.apiBaseUrl, recordId, reviewStatus, notes);
      }
      if (activeResult && activeResult.records) {
        const updated = activeResult.records.map((r) =>
          r.id === recordId ? { ...r, review_status: reviewStatus, review_notes: notes } : r
        );
        activeResult.records = updated;
      }
    } catch (err) {
      console.error('Error updating review decision:', err);
    }
  };

  const isLowConfidenceMode = settings.confidenceThreshold < 0.25;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Image Analysis
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Detect riders, helmets, and plates using YOLO11n with low-confidence recall and helmet conflict resolution.
          </p>
        </div>

        {/* Action Controls & Settings Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background-card border border-border text-xs text-text-primary">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse shrink-0" />
            <span className="font-semibold text-accent-cyan">All Detections View</span>
            <span className="text-text-muted">• conf &ge; {formatConfidence(settings.confidenceThreshold)}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            className={showSettings ? 'border-accent-cyan text-accent-cyan' : ''}
          >
            <span>Settings ({formatConfidence(settings.confidenceThreshold)})</span>
            {showSettings ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
          </Button>

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
            onClick={handleAnalyzeClick}
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

      {/* Inline Detection Settings Panel */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-background-card border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-accent-cyan" />
              <h3 className="text-xs font-semibold text-text-primary">
                Inference & Detection Parameters
              </h3>
            </div>
            <span className="text-[11px] text-text-muted">
              Configure confidence threshold, resolution, and NMS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* Confidence Threshold */}
            <div className="space-y-2 bg-background-secondary p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <label className="font-medium text-text-primary">
                  Confidence Threshold (min 5%)
                </label>
                <span className="font-mono text-accent-cyan font-bold">
                  {formatConfidence(settings.confidenceThreshold)}
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={settings.confidenceThreshold}
                onChange={(e) =>
                  updateSettings({ confidenceThreshold: Math.max(0.05, parseFloat(e.target.value)) })
                }
                className="w-full accent-accent-cyan cursor-pointer"
              />
              {/* Presets */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[
                  { label: '5% (Min)', val: 0.05 },
                  { label: '10%', val: 0.10 },
                  { label: '25% (Std)', val: 0.25 },
                  { label: '50%', val: 0.50 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => updateSettings({ confidenceThreshold: p.val })}
                    className={clsx(
                      'px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors',
                      Math.abs(settings.confidenceThreshold - p.val) < 0.005
                        ? 'bg-accent-cyan text-background font-semibold border-accent-cyan'
                        : 'bg-background-card text-text-muted border-border hover:text-text-primary'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* IoU NMS Threshold */}
            <div className="space-y-1.5 bg-background-secondary p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <label className="font-medium text-text-primary">
                  IoU NMS Threshold
                </label>
                <span className="font-mono text-text-secondary font-bold">
                  {Math.round(settings.iouThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={settings.iouThreshold}
                onChange={(e) =>
                  updateSettings({ iouThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-accent-cyan cursor-pointer"
              />
              <p className="text-[11px] text-text-muted">
                Non-maximum suppression threshold (default: 70%).
              </p>
            </div>

            {/* Input Image Resolution */}
            <div className="space-y-1.5 bg-background-secondary p-3 rounded-lg border border-border flex flex-col justify-between">
              <div>
                <label className="font-medium text-text-primary block mb-1">
                  Inference Resolution
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => updateSettings({ imageSize: 1280 })}
                    className={clsx(
                      'px-2 py-1.5 rounded text-xs font-medium border text-center transition-all',
                      settings.imageSize === 1280
                        ? 'bg-accent-cyan text-background font-semibold border-accent-cyan'
                        : 'bg-background-card text-text-secondary border-border hover:text-text-primary'
                    )}
                  >
                    1280 × 1280
                  </button>
                  <button
                    onClick={() => updateSettings({ imageSize: 640 })}
                    className={clsx(
                      'px-2 py-1.5 rounded text-xs font-medium border text-center transition-all',
                      settings.imageSize === 640
                        ? 'bg-accent-cyan text-background font-semibold border-accent-cyan'
                        : 'bg-background-card text-text-secondary border-border hover:text-text-primary'
                    )}
                  >
                    640 × 640
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                1280 provides finer detail for small helmet and plate boxes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Confidence Mode Alert Banner */}
      {isLowConfidenceMode && (
        <div className="p-3.5 rounded-xl bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-text-primary">
              High-Sensitivity Mode Active ({formatConfidence(settings.confidenceThreshold)}):{' '}
            </span>
            The model is evaluating detections down to {formatConfidence(settings.confidenceThreshold)} (threshold strictly maintained above 5.0%) to capture subtle or distant road objects. Conflicting overlapping helmet/no-helmet predictions are automatically resolved by confidence comparison.
          </div>
        </div>
      )}

      {/* Backend Offline Banner */}
      {health.status === 'offline' && !settings.demoMode && (
        <div className="p-4 rounded-xl bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-text-primary mb-1">
              FastAPI Backend Is Currently Offline
            </h4>
            <p className="text-text-secondary leading-relaxed">
              The application could not reach the backend at{' '}
              <code className="bg-background-card px-1.5 py-0.5 rounded font-mono text-text-primary">
                {settings.apiBaseUrl}
              </code>
              . Start the backend with{' '}
              <code className="bg-background-card px-1.5 py-0.5 rounded font-mono text-accent-cyan">
                python -m uvicorn backend.main:app --port 8000
              </code>{' '}
              or enable Demo Mode to preview full compliance features.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateSettings({ demoMode: true })}
              >
                Enable Demo Mode
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Mode Notice */}
      {settings.demoMode && (
        <div className="p-3.5 rounded-xl bg-accent-pink/10 border border-accent-pink/30 text-xs text-accent-pink flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
            <span>
              <strong>Demo Mode Active:</strong> Generating simulated YOLO11n detections and OCR registration compliance records.
            </span>
          </div>
          <button
            onClick={() => updateSettings({ demoMode: false })}
            className="text-[11px] font-semibold underline hover:text-white"
          >
            Turn Off Demo Mode
          </button>
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
                    Running YOLO11n Detection ({settings.imageSize}px, conf={formatConfidence(settings.confidenceThreshold)}) & OCR...
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Extracting neural layers, resolving helmet/no-helmet overlap conflicts, and performing license plate OCR
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
                <h4 className="font-semibold text-text-primary mb-0.5">Analysis Failed</h4>
                <p className="text-status-error/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Results Workspace: Activated once inference completes */}
          {hasResult && activeResult ? (
            <div className="space-y-6">
              {/* Data Collection & Export Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-background-card border border-border rounded-xl">
                <div>
                  <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                    <span>Inference Complete & Data Collected</span>
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {activeResult.detections.length} total objects identified ({activeResult.counts.rider} riders, {activeResult.counts.number_plate} plates) in {formatDuration(activeResult.inference_time_ms)}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border bg-background-secondary overflow-hidden">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadAnalysisResult(activeResult, 'roadvision_analysis', 'csv')}
                      title="Download collected detection records as CSV"
                      className="flex items-center gap-1.5 border-r border-border rounded-r-none text-xs hover:text-accent-green"
                    >
                      <Download className="w-3.5 h-3.5 text-accent-green" />
                      <span>Export CSV</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadAnalysisResult(activeResult, 'roadvision_analysis', 'json')}
                      title="Download complete analysis result with compliance & metadata as JSON"
                      className="flex items-center gap-1.5 rounded-l-none text-xs hover:text-accent-cyan"
                    >
                      <Download className="w-3.5 h-3.5 text-accent-cyan" />
                      <span>Export JSON</span>
                    </Button>
                  </div>
                </div>
              </div>

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
                    className={clsx(
                      'font-mono text-xl font-bold mt-1',
                      activeResult.counts.no_helmet > 0
                        ? 'text-status-error'
                        : 'text-status-success'
                    )}
                  >
                    {activeResult.counts.no_helmet}
                  </div>
                </div>
              </div>

              {/* Resolved Helmet Conflicts Notification */}
              {activeResult.resolved_conflicts && activeResult.resolved_conflicts.length > 0 && (
                <div className="p-3.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 text-xs text-accent-cyan flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold text-text-primary">
                      {activeResult.resolved_conflicts.length} Overlapping Helmet Conflict(s) Resolved:{' '}
                    </span>
                    The detector resolved ambiguous overlapping helmet/no-helmet boxes by retaining the higher-confidence prediction and suppressing the lower-confidence counterpart (IoU ≥ 0.50).
                  </div>
                </div>
              )}

              {/* Zero Detections Notice */}
              {activeResult.detections.length === 0 ? (
                <div className="p-6 rounded-xl bg-background-card border border-border text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-status-success mx-auto opacity-70" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    No objects were detected in this image.
                  </h3>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    The model completed evaluation but found no objects above the current{' '}
                    {formatConfidence(settings.confidenceThreshold)} threshold. You can adjust the threshold down to 5% in Settings.
                  </p>
                </div>
              ) : (
                <>
                  {/* Quality Summary Breakdown Bar */}
                  {activeResult.quality_summary && (
                    <div className="p-3.5 rounded-xl bg-background-card border border-border flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-text-primary">Detection Breakdown:</span>
                      <span className="px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 font-mono text-[11px]">
                        High Confidence (&ge;25%): {activeResult.quality_summary.high_confidence}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning border border-status-warning/30 font-mono text-[11px]">
                        Low Confidence (&lt;25%): {activeResult.quality_summary.low_confidence}
                      </span>
                      {activeResult.quality_summary.potential_duplicate > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[11px]">
                          Borderline Duplicates: {activeResult.quality_summary.potential_duplicate}
                        </span>
                      )}
                      {activeResult.quality_summary.suspicious_geometry > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-status-error/15 text-status-error border border-status-error/30 font-mono text-[11px]">
                          Suspicious Geometry: {activeResult.quality_summary.suspicious_geometry}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Class Summary Breakdown with interactive filtering */}
                  <DetectionSummary
                    counts={activeResult.counts}
                    totalDetections={displayedDetections.length}
                    activeFilter={activeFilterClass}
                    onFilterChange={setActiveFilterClass}
                  />

                  {/* Image Comparison & Evidence Viewport */}
                  <ComparisonViewer
                    originalUrl={activePreviewUrl}
                    result={{ ...activeResult, detections: displayedDetections }}
                    highlightedId={highlightedDetectionId}
                    selectedId={selectedDetectionId}
                    onSelectDetection={setSelectedDetectionId}
                    activeFilterClass={activeFilterClass}
                    onDimensionsUpdate={setFrontendDims}
                  />

                  {/* Dual Tab Workspace: All Detections Table & Plate Compliance Records */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <button
                        onClick={() => setResultTab('detections')}
                        className={clsx(
                          'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                          resultTab === 'detections'
                            ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                            : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                        )}
                      >
                        <Layers className="w-4 h-4" />
                        <span>All Model Detections</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-background border border-border">
                          {displayedDetections.length}
                        </span>
                      </button>

                      {activeResult.records && activeResult.records.length > 0 && (
                        <button
                          onClick={() => setResultTab('compliance')}
                          className={clsx(
                            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                            resultTab === 'compliance'
                              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                              : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                          )}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>License Plate & Helmet Compliance</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-background border border-border">
                            {activeResult.records.length}
                          </span>
                        </button>
                      )}
                    </div>

                    {resultTab === 'detections' ? (
                      <DetectionTable
                        detections={displayedDetections}
                        highlightedId={highlightedDetectionId}
                        selectedId={selectedDetectionId}
                        onHoverDetection={setHighlightedDetectionId}
                        onSelectDetection={setSelectedDetectionId}
                        activeFilterClass={activeFilterClass}
                      />
                    ) : (
                      activeResult.records && activeResult.records.length > 0 && (
                        <ComplianceTable
                          records={activeResult.records}
                          onUpdateStatus={handleUpdateReview}
                        />
                      )
                    )}
                  </div>
                </>
              )}

              {/* Developer Diagnostics Panel */}
              <DiagnosticsPanel
                result={activeResult}
                settings={settings}
                frontendDims={frontendDims}
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
                  Ready to analyze with YOLO11n ({settings.imageSize}px, conf={formatConfidence(settings.confidenceThreshold)}) and EasyOCR.
                </span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAnalyzeClick}
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
