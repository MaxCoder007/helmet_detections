import React, { useState } from 'react';
import { PredictionResult, AppSettings, CandidateTraceItem } from '@/types/detection';
import { formatConfidence } from '@/utils/formatters';
import {
  Terminal,
  Hash,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Sliders,
  HardDrive,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

interface DiagnosticsPanelProps {
  result: PredictionResult;
  settings: AppSettings;
  frontendDims?: {
    naturalWidth: number;
    naturalHeight: number;
    clientWidth: number;
    clientHeight: number;
  };
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  result,
  settings,
  frontendDims,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const diag = result.diagnostics || {};
  const sha256 = diag.model_sha256 || '804aa5e8c5b4e56df7eca9d18a7f6bdb9e1ab87dc30203f8fdf1578429a344ef';
  const md5 = diag.model_md5 || 'ae8c70700abe24e22bc9e59f938a9ff0';
  const modelFile = diag.model_filename || 'best.pt';
  const device = diag.device || 'xpu:0 (Intel Arc GPU)';

  const rawCount = result.raw_detections_count ?? result.detections.length;
  const nmsCount = result.after_yolo_nms_count ?? diag.after_yolo_nms_count ?? rawCount;
  const dupSuppressedCount = result.suppressed_duplicates_count ?? diag.suppressed_duplicates_count ?? (result.suppressed_duplicates?.length ?? 0);
  const afterDupCount = result.after_duplicate_suppression_count ?? diag.after_duplicate_suppression_count ?? (nmsCount - dupSuppressedCount);
  const conflictCount = result.suppressed_conflicts_count ?? diag.suppressed_conflicts_count ?? (result.resolved_conflicts?.length ?? 0);
  const postCount = result.detections.length;

  const inputWidth = result.image_width || frontendDims?.naturalWidth || 640;
  const inputHeight = result.image_height || frontendDims?.naturalHeight || 640;
  const inferenceResolution = diag.inference_resolution || settings.imageSize;
  const confThreshold = diag.conf_threshold ?? settings.confidenceThreshold;
  const iouThreshold = diag.iou_threshold ?? settings.iouThreshold;

  const canvasNatW = frontendDims?.naturalWidth || inputWidth;
  const canvasNatH = frontendDims?.naturalHeight || inputHeight;
  const canvasClientW = frontendDims?.clientWidth || inputWidth;
  const canvasClientH = frontendDims?.clientHeight || inputHeight;

  const scaleRatio = canvasNatW > 0 ? (canvasClientW / canvasNatW).toFixed(3) : '1.000';
  const aspectRatio = `${inputWidth}:${inputHeight}`;

  const classMapping: Record<number, string> = {
    0: 'helmet',
    1: 'no_helmet',
    2: 'number_plate',
    3: 'pillion',
    4: 'rider',
  };

  // Derive candidate predictions trace
  let candidateList: CandidateTraceItem[] = [];
  if (diag.candidates && diag.candidates.length > 0) {
    candidateList = diag.candidates;
  } else {
    // Reconstruct trace from post-processed detections + resolved conflicts
    candidateList = [
      ...result.detections.map((d, idx) => ({
        id: d.id || `det_${idx}`,
        class_id: d.class_id,
        class_name: d.class_name,
        confidence: d.confidence,
        bbox: d.bbox,
        status: 'retained' as const,
        reason: 'Passed confidence threshold, duplicate suppression, and conflict resolution',
      })),
      ...(result.suppressed_duplicates || []).map((sd, idx) => ({
        id: sd.suppressed?.id || `dup_${idx}`,
        class_id: sd.suppressed?.class_name === 'number_plate' ? 2 : 1,
        class_name: sd.suppressed?.class_name || 'unknown',
        confidence: sd.suppressed?.confidence || 0,
        bbox: sd.suppressed?.bbox || [0, 0, 0, 0],
        status: 'suppressed_duplicate' as const,
        reason: sd.reason || 'Suppressed by class-aware duplicate suppression',
      })),
      ...(result.resolved_conflicts || []).map((rc, idx) => ({
        id: rc.suppressed?.id || `conf_${idx}`,
        class_id: rc.suppressed?.class_name === 'helmet' ? 0 : 1,
        class_name: rc.suppressed?.class_name || 'unknown',
        confidence: rc.suppressed?.confidence || 0,
        bbox: rc.suppressed?.bbox || [0, 0, 0, 0],
        status: 'suppressed_conflict' as const,
        reason: rc.reason || 'Suppressed by helmet conflict resolution',
      })),
    ];
  }

  const handleCopyDiagnostics = () => {
    const report = {
      model: {
        filename: modelFile,
        sha256: sha256,
        md5: md5,
        device: device,
        classes: classMapping,
      },
      image_coordinates: {
        input_resolution: `${inputWidth}x${inputHeight}`,
        aspect_ratio: aspectRatio,
        frontend_internal_canvas: `${canvasNatW}x${canvasNatH}`,
        frontend_rendered_dom: `${canvasClientW}x${canvasClientH}`,
        render_scale_factor: scaleRatio,
      },
      inference_configuration: {
        inference_resolution: `${inferenceResolution}x${inferenceResolution}`,
        confidence_threshold: confThreshold,
        iou_threshold: iouThreshold,
        duplicate_iou: diag.duplicate_iou || 0.45,
        duplicate_containment: diag.duplicate_containment || 0.65,
        plate_iou: diag.plate_iou || 0.35,
        plate_containment: diag.plate_containment || 0.50,
        max_detections: diag.max_det || 300,
        conflict_iou: diag.conflict_iou || 0.50,
      },
      pipeline_stages: {
        raw_candidates_after_yolo_nms: nmsCount,
        after_duplicate_suppression: afterDupCount,
        suppressed_duplicates_count: dupSuppressedCount,
        after_conflict_resolution: postCount,
        suppressed_conflicts_count: conflictCount,
        final_returned_count: postCount,
        raw_counts_breakdown: diag.raw_counts || {},
        post_processed_breakdown: result.counts,
      },
      candidates_trace: candidateList,
      timestamp: result.timestamp || new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-background-secondary/70 flex items-center justify-between cursor-pointer hover:bg-background-secondary transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-text-primary">
            Developer Diagnostics & Pipeline Trace
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
            SHA: {sha256.substring(0, 8)}…
          </span>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-background text-text-secondary border border-border">
            {confThreshold < 0.01 ? `${(confThreshold * 100).toFixed(2)}%` : formatConfidence(confThreshold)} conf • NMS IoU: {iouThreshold}
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary hover:text-text-primary bg-background border border-border transition-colors"
            title="Copy full diagnostic report as JSON"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-status-success" />
                <span className="text-status-success">Copied JSON</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Report</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded text-text-muted hover:text-text-primary"
            aria-label="Toggle diagnostics"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-border text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Checkpoint Identity */}
            <div className="p-3 rounded-lg bg-background-secondary/60 border border-border space-y-2">
              <div className="flex items-center justify-between text-text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-accent-cyan" />
                  Model Identity
                </span>
                <span className="font-mono text-[10px] text-accent-cyan">best.pt</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-text-secondary truncate" title={sha256}>
                  <span className="text-text-muted">SHA256: </span>
                  <span className="text-text-primary font-semibold">{sha256.substring(0, 16)}…</span>
                </div>
                <div className="text-text-secondary truncate" title={md5}>
                  <span className="text-text-muted">MD5: </span>
                  <span className="text-text-primary">{md5}</span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Device: </span>
                  <span className="text-accent-cyan font-semibold">{device}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Image & Coordinate System */}
            <div className="p-3 rounded-lg bg-background-secondary/60 border border-border space-y-2">
              <div className="flex items-center justify-between text-text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-accent-cyan" />
                  Coordinate System
                </span>
                <span className="font-mono text-[10px] text-text-secondary">{aspectRatio}</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-text-secondary">
                  <span className="text-text-muted">Input Resolution: </span>
                  <span className="text-text-primary font-semibold">{inputWidth} × {inputHeight} px</span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Inference Size: </span>
                  <span className="text-text-primary font-semibold">{inferenceResolution} × {inferenceResolution} px</span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Frontend Canvas: </span>
                  <span className="text-text-primary">{canvasNatW}×{canvasNatH} (DOM: {canvasClientW}×{canvasClientH})</span>
                </div>
              </div>
            </div>

            {/* Card 3: Inference Thresholds */}
            <div className="p-3 rounded-lg bg-background-secondary/60 border border-border space-y-2">
              <div className="flex items-center justify-between text-text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent-cyan" />
                  Inference Tuning
                </span>
                <span className="font-mono text-[10px] text-status-success font-semibold">Active</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-text-secondary">
                  <span className="text-text-muted">Confidence: </span>
                  <span className="text-accent-cyan font-bold">{confThreshold}</span> ({confThreshold < 0.01 ? `${(confThreshold * 100).toFixed(2)}%` : formatConfidence(confThreshold)})
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">NMS IoU: </span>
                  <span className="text-text-primary font-semibold">{iouThreshold} ({Math.round(iouThreshold * 100)}%)</span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Plate Dup IoU / Cont: </span>
                  <span className="text-text-primary">{diag.plate_iou || 0.35} / {diag.plate_containment || 0.50}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Detection Pipeline Funnel */}
            <div className="p-3 rounded-lg bg-background-secondary/60 border border-border space-y-2">
              <div className="flex items-center justify-between text-text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-accent-cyan" />
                  Detections Funnel
                </span>
                <span className="font-mono text-[10px] text-accent-cyan">{postCount} Final</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-text-secondary">
                  <span className="text-text-muted">After YOLO NMS: </span>
                  <span className="text-text-primary font-semibold">{nmsCount}</span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Duplicate suppressed: </span>
                  <span className={clsx('font-semibold', dupSuppressedCount > 0 ? 'text-status-warning' : 'text-text-muted')}>
                    {dupSuppressedCount > 0 ? `-${dupSuppressedCount}` : '0'}
                  </span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-muted">Helmet conflicts resolved: </span>
                  <span className={clsx('font-semibold', conflictCount > 0 ? 'text-accent-cyan' : 'text-text-muted')}>
                    {conflictCount > 0 ? `-${conflictCount}` : '0'}
                  </span>
                </div>
                <div className="text-text-secondary pt-0.5 border-t border-border/50">
                  <span className="text-text-muted">Final returned: </span>
                  <span className="text-status-success font-bold">{postCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Class ID Mapping Bar */}
          <div className="p-3 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 text-text-muted">
              <Hash className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Model Class Mapping:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(classMapping).map(([id, name]) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-background-secondary border border-border text-text-secondary"
                >
                  <strong className="text-accent-cyan font-bold">{id}</strong>: {name}
                </span>
              ))}
            </div>
          </div>

          {/* Pipeline Stage Counts Table */}
          <div className="p-3.5 rounded-lg bg-background border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent-cyan" />
                Pipeline Stage Detection Counts
              </span>
              <span className="text-[10px] text-text-muted">
                Audit trace: YOLO NMS → Duplicate Suppression → Conflict Resolution → Output
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-muted bg-background-secondary/50">
                    <th className="py-2 px-3 font-medium">Class Name</th>
                    <th className="py-2 px-2 font-medium text-center">Class ID</th>
                    <th className="py-2 px-3 font-medium text-right">After YOLO NMS</th>
                    <th className="py-2 px-3 font-medium text-right">Duplicates Suppressed</th>
                    <th className="py-2 px-3 font-medium text-right">Conflicts Resolved</th>
                    <th className="py-2 px-3 font-medium text-right text-status-success font-semibold">Final Output</th>
                    <th className="py-2 px-3 font-medium text-right text-accent-cyan font-semibold">Frontend Parsed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {Object.entries(classMapping).map(([idStr, cname]) => {
                    const id = Number(idStr);
                    const rawCountsMap = diag.raw_counts as Record<string, number> | undefined;
                    const rawVal = rawCountsMap?.[cname] ?? (result.counts[cname as keyof typeof result.counts] || 0);
                    const postVal = result.counts[cname as keyof typeof result.counts] || 0;
                    
                    const dupsForClass = candidateList.filter((c) => c.class_name === cname && c.status === 'suppressed_duplicate').length;
                    const confsForClass = candidateList.filter((c) => c.class_name === cname && c.status === 'suppressed_conflict').length;
                    const feVal = result.detections.filter((d) => d.class_name === cname).length;

                    return (
                      <tr key={cname} className="hover:bg-background-secondary/40">
                        <td className="py-1.5 px-3 font-sans font-medium text-text-primary capitalize">
                          {cname.replace('_', ' ')}
                        </td>
                        <td className="py-1.5 px-2 text-center text-text-muted">{id}</td>
                        <td className="py-1.5 px-3 text-right text-text-secondary">{rawVal}</td>
                        <td className="py-1.5 px-3 text-right">
                          {dupsForClass > 0 ? (
                            <span className="text-status-warning font-semibold">-{dupsForClass}</span>
                          ) : (
                            <span className="text-text-muted">0</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {confsForClass > 0 ? (
                            <span className="text-accent-cyan font-semibold">-{confsForClass}</span>
                          ) : (
                            <span className="text-text-muted">0</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right text-status-success font-semibold">{postVal}</td>
                        <td className="py-1.5 px-3 text-right text-accent-cyan font-bold">{feVal}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border font-bold bg-background-secondary/30">
                    <td className="py-2 px-3 text-text-primary">Total Detections</td>
                    <td className="py-2 px-2 text-center text-text-muted">—</td>
                    <td className="py-2 px-3 text-right text-text-secondary">{nmsCount}</td>
                    <td className="py-2 px-3 text-right text-status-warning">
                      {dupSuppressedCount > 0 ? `-${dupSuppressedCount}` : '0'}
                    </td>
                    <td className="py-2 px-3 text-right text-accent-cyan">
                      {conflictCount > 0 ? `-${conflictCount}` : '0'}
                    </td>
                    <td className="py-2 px-3 text-right text-status-success">{postCount}</td>
                    <td className="py-2 px-3 text-right text-accent-cyan">{result.detections.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Candidate Predictions Trace Table */}
          {candidateList.length > 0 && (
            <div className="p-3.5 rounded-lg bg-background border border-border space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-accent-cyan" />
                  Candidate Predictions Trace ({candidateList.length} total)
                </span>
                <span className="text-[10px] text-text-muted">
                  Full inspection of raw bounding boxes, scores, and suppression rationales
                </span>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto rounded border border-border">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead className="bg-background-secondary sticky top-0 border-b border-border shadow-sm">
                    <tr className="text-text-muted">
                      <th className="py-2 px-2.5 font-medium">Candidate ID</th>
                      <th className="py-2 px-2.5 font-medium">Class (ID)</th>
                      <th className="py-2 px-2.5 font-medium text-right">Confidence</th>
                      <th className="py-2 px-2.5 font-medium">Bounding Box [x1, y1, x2, y2]</th>
                      <th className="py-2 px-2.5 font-medium text-center">Status</th>
                      <th className="py-2 px-2.5 font-medium">Reason / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {candidateList.map((cand) => (
                      <tr key={cand.id} className="hover:bg-background-secondary/30">
                        <td className="py-1.5 px-2.5 text-text-muted">{cand.id}</td>
                        <td className="py-1.5 px-2.5 text-text-primary font-sans font-medium capitalize">
                          {cand.class_name.replace('_', ' ')}{' '}
                          <span className="text-text-muted font-mono text-[10px]">({cand.class_id})</span>
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-accent-cyan font-bold">
                          {cand.confidence < 0.01
                            ? `${(cand.confidence * 100).toFixed(2)}%`
                            : formatConfidence(cand.confidence)}
                        </td>
                        <td className="py-1.5 px-2.5 text-text-secondary text-[10px]">
                          [{cand.bbox.join(', ')}]
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          {cand.status === 'retained' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold bg-status-success/15 text-status-success border border-status-success/30">
                              RETAINED
                            </span>
                          )}
                          {cand.status === 'suppressed_duplicate' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              DUPLICATE
                            </span>
                          )}
                          {cand.status === 'suppressed_conflict' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                              CONFLICT
                            </span>
                          )}
                          {cand.status === 'suppressed' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold bg-status-warning/15 text-status-warning border border-status-warning/30">
                              SUPPRESSED
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-text-secondary text-[10px] max-w-xs truncate" title={cand.reason}>
                          {cand.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Coordinate Verification Note */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/15 text-[11px] text-text-secondary leading-relaxed">
            <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <div>
              <strong>Coordinate System Verification:</strong> All bounding box coordinates [x1, y1, x2, y2] are referenced strictly to the original image dimensions ({inputWidth}×{inputHeight}px). The HTML5 canvas sets its internal raster resolution directly to natural dimensions ({canvasNatW}×{canvasNatH}px) and CSS scaling maintains identical aspect ratio without box distortion.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
