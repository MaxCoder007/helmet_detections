import React, { useState, useEffect } from 'react';
import {
  ViolationRecord,
  ViolationReviewStatus,
} from '@/types/violation';
import { getEvidenceUrl, updateViolationReview } from '@/services/violationApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  X,
  ShieldAlert,
  HelpCircle,
  FileText,
  Camera,
  Image as ImageIcon,
  Save,
  Check,
  Hash,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatTime } from '@/utils/formatters';

interface ViolationEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  violation: ViolationRecord | null;
  baseUrl: string;
  onRecordUpdated?: (updated: ViolationRecord) => void;
}

export const ViolationEvidenceModal: React.FC<ViolationEvidenceModalProps> = ({
  isOpen,
  onClose,
  violation,
  baseUrl,
  onRecordUpdated,
}) => {
  if (!isOpen || !violation) return null;

  const [reviewStatus, setReviewStatus] = useState<ViolationReviewStatus>(
    violation.review_status || 'pending'
  );
  const [manualReg, setManualReg] = useState<string>(
    violation.manual_registration_number || ''
  );
  const [reviewNotes, setReviewNotes] = useState<string>(
    violation.review_notes || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setReviewStatus(violation.review_status || 'pending');
    setManualReg(violation.manual_registration_number || '');
    setReviewNotes(violation.review_notes || '');
    setSaveSuccess(false);
    setErrorMsg(null);
  }, [violation]);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);
    try {
      const updated = await updateViolationReview(baseUrl, violation.id, {
        review_status: reviewStatus,
        manual_registration_number: manualReg.trim() ? manualReg.trim().toUpperCase() : null,
        review_notes: reviewNotes.trim() || null,
      });
      setSaveSuccess(true);
      if (onRecordUpdated) {
        onRecordUpdated(updated);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update review status.');
    } finally {
      setIsSaving(false);
    }
  };

  const originalUrl = getEvidenceUrl(baseUrl, violation.id, 'original');
  const riderUrl = violation.rider_crop_path ? getEvidenceUrl(baseUrl, violation.id, 'rider') : null;
  const plateUrl = violation.plate_crop_path ? getEvidenceUrl(baseUrl, violation.id, 'number_plate') : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-background-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-text-primary">
                  Violation Record: {violation.id}
                </h3>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium uppercase',
                    violation.review_status === 'resolved'
                      ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                      : violation.review_status === 'reviewed'
                      ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                      : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                  )}
                >
                  {violation.review_status}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Timestamp: {formatTime(violation.violation_timestamp)} • Source: {violation.source_type} ({violation.source_reference || 'upload'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Evidence Image Gallery */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-accent-cyan" />
              Captured Evidence Images
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Original Scene */}
              <div className="flex flex-col bg-background border border-border rounded-lg overflow-hidden">
                <div className="p-2 bg-background-tertiary border-b border-border text-xs font-medium text-text-secondary flex items-center justify-between">
                  <span>Full Scene Overview</span>
                  <span className="text-[10px] text-text-muted">original.jpg</span>
                </div>
                <div className="relative aspect-video flex items-center justify-center bg-black/40 p-1">
                  <img
                    src={originalUrl}
                    alt="Original evidence scene"
                    className="max-h-full max-w-full object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Rider Crop */}
              <div className="flex flex-col bg-background border border-border rounded-lg overflow-hidden">
                <div className="p-2 bg-background-tertiary border-b border-border text-xs font-medium text-text-secondary flex items-center justify-between">
                  <span>Rider Evidence Crop</span>
                  <span className="text-[10px] text-text-muted">rider.jpg</span>
                </div>
                <div className="relative aspect-video flex items-center justify-center bg-black/40 p-1">
                  {riderUrl ? (
                    <img
                      src={riderUrl}
                      alt="Rider evidence crop"
                      className="max-h-full max-w-full object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-center p-4 text-xs text-text-muted">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      Rider crop not available
                    </div>
                  )}
                </div>
              </div>

              {/* Number Plate Crop */}
              <div className="flex flex-col bg-background border border-border rounded-lg overflow-hidden">
                <div className="p-2 bg-background-tertiary border-b border-border text-xs font-medium text-text-secondary flex items-center justify-between">
                  <span>Number Plate Crop</span>
                  <span className="text-[10px] text-text-muted">number_plate.jpg</span>
                </div>
                <div className="relative aspect-video flex items-center justify-center bg-black/40 p-1">
                  {plateUrl ? (
                    <img
                      src={plateUrl}
                      alt="Number plate evidence crop"
                      className="max-h-full max-w-full object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-center p-4 text-xs text-text-muted">
                      <HelpCircle className="w-6 h-6 mx-auto mb-1 opacity-40 text-accent-amber" />
                      <span className="text-accent-amber font-medium">Plate not detected</span>
                      <p className="text-[10px] text-text-muted mt-0.5">No plate box was detected in scene</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle & Plate Association Status */}
            <Card className="p-4 bg-background border-border">
              <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                Vehicle Association & OCR Status
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Association Status:</span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded font-medium',
                      violation.vehicle_association_status === 'confirmed'
                        ? 'bg-accent-green/10 text-accent-green'
                        : violation.vehicle_association_status === 'uncertain'
                        ? 'bg-accent-amber/10 text-accent-amber'
                        : 'bg-text-muted/10 text-text-muted'
                    )}
                  >
                    {violation.vehicle_association_status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">OCR Status:</span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded font-medium',
                      violation.ocr_status === 'recognized'
                        ? 'bg-accent-cyan/10 text-accent-cyan'
                        : violation.ocr_status === 'unreadable'
                        ? 'bg-accent-amber/10 text-accent-amber'
                        : 'bg-text-muted/10 text-text-muted'
                    )}
                  >
                    {violation.ocr_status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">OCR Recognized Plate:</span>
                  <span className="font-mono font-bold text-text-primary">
                    {violation.registration_number || (
                      <span className="italic text-text-muted font-normal">Unidentified</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Raw OCR Engine Text:</span>
                  <span className="font-mono text-text-secondary">
                    {violation.raw_ocr_text ? `"${violation.raw_ocr_text}"` : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-text-muted">OCR Confidence:</span>
                  <span className="text-text-primary">
                    {violation.ocr_confidence !== null
                      ? `${(violation.ocr_confidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Violation Details */}
            <Card className="p-4 bg-background border-border">
              <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                Violation Parameters
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Violation Type:</span>
                  <span className="px-2 py-0.5 rounded bg-accent-red/10 text-accent-red font-medium">
                    {violation.violation_type}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Plate YOLO Confidence:</span>
                  <span className="text-text-primary">
                    {violation.plate_detection_confidence !== null
                      ? `${(violation.plate_detection_confidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Source Reference:</span>
                  <span className="text-text-primary truncate max-w-[180px]">
                    {violation.source_reference || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-text-muted">System Notes:</span>
                  <span className="text-text-muted italic truncate max-w-[200px]" title={violation.notes}>
                    {violation.notes || 'None'}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Manual Human Review Panel */}
          <div className="p-4 rounded-lg bg-background border border-accent-cyan/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent-cyan" />
                Manual Review & Registration Correction
              </h5>
              <span className="text-[11px] text-text-muted">
                Original OCR output is preserved separately
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Manually Verified Registration Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualReg}
                    onChange={(e) => setManualReg(e.target.value.toUpperCase())}
                    placeholder={violation.registration_number || 'e.g. KA01AB1234'}
                    className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-cyan"
                  />
                  <Hash className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  Enter registration if OCR was unreadable or partially occluded.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Review Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as ViolationReviewStatus)}
                  className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
                >
                  <option value="pending">Pending Review</option>
                  <option value="reviewed">Reviewed (Confirmed)</option>
                  <option value="resolved">Resolved (Dismissed / Closed)</option>
                </select>
                <p className="text-[10px] text-text-muted mt-1">
                  Update compliance workflow state.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Reviewer Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes or justification regarding vehicle verification..."
                className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-cyan resize-none"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red">
                {errorMsg}
              </div>
            )}

            {saveSuccess && (
              <div className="p-2.5 rounded bg-accent-green/10 border border-accent-green/20 text-xs text-accent-green flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Violation review updated successfully.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Review Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
