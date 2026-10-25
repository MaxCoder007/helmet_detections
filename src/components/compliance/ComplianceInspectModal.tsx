import React, { useState } from 'react';
import { ComplianceRecord, ReviewStatus } from '@/types/detection';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Eye,
  FileText,
  AlertCircle,
  Check,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatConfidence, formatTime } from '@/utils/formatters';
import { downloadComplianceRecord } from '@/utils/exportUtils';
import { clsx } from 'clsx';

interface ComplianceInspectModalProps {
  record: ComplianceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (recordId: string, status: ReviewStatus, notes?: string) => Promise<void>;
}

export const ComplianceInspectModal: React.FC<ComplianceInspectModalProps> = ({
  record,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
    record?.review_status || 'pending_review'
  );
  const [reviewNotes, setReviewNotes] = useState(record?.review_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !record) return null;

  const handleSaveReview = async () => {
    if (!onUpdateStatus) return;
    setIsSaving(true);
    try {
      await onUpdateStatus(record.id, reviewStatus, reviewNotes);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update review status:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-background-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background-card/95 backdrop-blur z-10">
          <div>
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent-cyan" />
              <span>Inspection: {record.registration_number || 'Unreadable Plate'}</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Record ID: <span className="font-mono text-text-secondary">{record.id}</span> •{' '}
              {formatTime(new Date(record.timestamp).getTime())}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Top Status Alert Banners */}
          {record.violation_candidate && (
            <div className="p-3.5 rounded-xl bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-text-primary">Violation Candidate Flagged</h4>
                <p className="text-status-error/90 mt-0.5 leading-relaxed">
                  The detector verified a rider without a protective helmet reliably associated with this registration number. This automated flag requires human verification before official enforcement.
                </p>
              </div>
            </div>
          )}

          {record.association_status === 'uncertain' && (
            <div className="p-3.5 rounded-xl bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning flex items-start gap-3">
              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-text-primary">Association Uncertain</h4>
                <p className="text-status-warning/90 mt-0.5 leading-relaxed">
                  Multiple riders or motorcycles were observed in proximity to this plate. To prevent misattribution, the system marked the association as uncertain and suppressed automated violation flagging.
                </p>
              </div>
            </div>
          )}

          {/* Evidence Grid: Cropped Plate & Associated Detections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cropped Plate View */}
            <div className="bg-background-secondary p-4 rounded-xl border border-border space-y-3">
              <span className="text-xs font-medium text-text-secondary flex items-center justify-between">
                <span>Cropped Plate Evidence</span>
                <span className="font-mono text-[11px] text-accent-cyan">
                  {record.ocr_status.toUpperCase()}
                </span>
              </span>

              <div className="h-28 bg-black/60 rounded-lg border border-border flex items-center justify-center p-2 overflow-hidden">
                {record.plate_crop_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${record.plate_crop_base64}`}
                    alt="Cropped License Plate"
                    className="max-h-full max-w-full object-contain filter contrast-125"
                  />
                ) : (
                  <div className="text-center text-xs text-text-muted">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <span>No plate crop available</span>
                  </div>
                )}
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Normalized Plate:</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {record.registration_number || 'Unreadable'}
                  </span>
                </div>
                {record.raw_ocr_text && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Raw OCR Output:</span>
                    <span className="font-mono text-text-secondary text-[11px]">
                      "{record.raw_ocr_text}"
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">OCR Confidence:</span>
                  <span className="font-mono text-accent-cyan font-medium">
                    {formatConfidence(record.ocr_confidence)}
                  </span>
                </div>
              </div>
            </div>

            {/* Helmet & Association Details */}
            <div className="bg-background-secondary p-4 rounded-xl border border-border space-y-3">
              <span className="text-xs font-medium text-text-secondary">
                Compliance & Rider Association
              </span>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-background-card border border-border flex items-center justify-between">
                  <span className="text-text-muted">Helmet Status:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    {record.helmet_status === 'helmet_detected' ? (
                      <span className="text-status-success flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Helmet Detected</span>
                      </span>
                    ) : record.helmet_status === 'no_helmet_detected' ? (
                      <span className="text-status-error flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>No Helmet Detected</span>
                      </span>
                    ) : (
                      <span className="text-status-warning flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{record.helmet_status}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-background-card border border-border flex items-center justify-between">
                  <span className="text-text-muted">Detection Confidence:</span>
                  <span className="font-mono text-text-primary font-medium">
                    {formatConfidence(record.helmet_confidence)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-background-card border border-border flex items-center justify-between">
                  <span className="text-text-muted">Association Status:</span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded text-[11px] font-medium border',
                      record.association_status === 'associated'
                        ? 'bg-status-success/10 text-status-success border-status-success/30'
                        : record.association_status === 'uncertain'
                        ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                        : 'bg-background-hover text-text-secondary border-border'
                    )}
                  >
                    {record.association_status === 'associated'
                      ? 'Associated'
                      : record.association_status === 'uncertain'
                      ? 'Association Uncertain'
                      : 'No Rider'}
                  </span>
                </div>

                {record.notes && (
                  <p className="text-[11px] text-text-muted italic pt-1 leading-normal">
                    {record.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Human Review & Adjudication Controls */}
          {onUpdateStatus && (
            <div className="p-4 rounded-xl bg-background-secondary border border-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <FileText className="w-4 h-4 text-accent-cyan" />
                <span>Human Review & Adjudication</span>
              </div>
              <p className="text-[11px] text-text-muted">
                Inspect evidence and confirm or dismiss this compliance assessment. Automated findings must never be penalized without review.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { id: 'approved', label: 'Approve' },
                    { id: 'disapproved', label: 'Disapprove' },
                    { id: 'verified_violation', label: 'Verify Violation' },
                    { id: 'compliant', label: 'Compliant' },
                    { id: 'dismissed', label: 'Dismiss' },
                    { id: 'pending_review', label: 'Pending Review' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setReviewStatus(s.id)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                      reviewStatus === s.id
                        ? s.id === 'approved' || s.id === 'compliant'
                          ? 'bg-status-success text-background font-semibold border-status-success'
                          : s.id === 'disapproved' || s.id === 'dismissed'
                          ? 'bg-status-error text-white font-semibold border-status-error'
                          : 'bg-accent-cyan text-background font-semibold border-accent-cyan'
                        : 'bg-background-card text-text-secondary border-border hover:text-text-primary'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] text-text-muted font-medium">
                  Reviewer Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes explaining manual verification or dismissal..."
                  className="w-full bg-background-card border border-border rounded-lg p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadComplianceRecord(record, 'json')}
                  leftIcon={<Download className="w-3.5 h-3.5 text-accent-cyan" />}
                  className="text-xs"
                >
                  Download Record
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveReview}
                  isLoading={isSaving}
                  leftIcon={savedSuccess ? <Check className="w-3.5 h-3.5" /> : undefined}
                >
                  {savedSuccess ? 'Saved' : 'Save Review Decision'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
