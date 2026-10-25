import React, { useState, useEffect } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ComplianceRecord, ReviewStatus } from '@/types/detection';
import { fetchBackendRecords, updateRecordReviewStatus } from '@/services/api';
import { ComplianceInspectModal } from '@/components/compliance/ComplianceInspectModal';
import {
  formatTime,
  formatDuration,
  formatFileSize,
  formatConfidence,
  sanitizeFilename,
} from '@/utils/formatters';
import {
  History,
  Trash2,
  Download,
  ArrowRight,
  Clock,
  Search,
  ImageIcon,
  Film,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  RefreshCw,
  Database,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  XCircle,
  FileCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ClassBadge } from '@/components/detection/ClassBadge';

export const HistoryPage: React.FC = () => {
  const {
    history,
    clearHistory,
    loadHistoryRecord,
    settings,
    health,
    updateHistoryRecordApproval,
    updateDetectionApproval,
  } = useDetection();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'compliance' | 'sessions'>('compliance');
  const [searchQuery, setSearchQuery] = useState('');
  const [helmetFilter, setHelmetFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [sessionApprovalFilter, setSessionApprovalFilter] = useState('all');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ComplianceRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [backendRecords, setBackendRecords] = useState<ComplianceRecord[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  // Collect compliance records from session history
  const sessionComplianceRecords: ComplianceRecord[] = history.flatMap(
    (h) => h.result.records || []
  );

  // Fetch durable SQLite records from backend if available
  const loadBackendRecords = async () => {
    if (health.status !== 'ok') return;
    setIsLoadingBackend(true);
    try {
      const data = await fetchBackendRecords(settings.apiBaseUrl, {
        limit: 100,
        registration: searchQuery || undefined,
        helmet_status: helmetFilter !== 'all' ? helmetFilter : undefined,
      });
      setBackendRecords(data.records);
    } catch (err) {
      console.error('Failed to fetch backend records:', err);
    } finally {
      setIsLoadingBackend(false);
    }
  };

  useEffect(() => {
    loadBackendRecords();
  }, [health.status, settings.apiBaseUrl]);

  // Use backend records if available, otherwise session compliance records
  const allComplianceRecords =
    backendRecords.length > 0
      ? backendRecords
      : sessionComplianceRecords;

  // Filter compliance records
  const filteredCompliance = allComplianceRecords.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlate = r.registration_number?.toLowerCase().includes(q);
      const matchRaw = r.raw_ocr_text?.toLowerCase().includes(q);
      const matchFile = r.filename?.toLowerCase().includes(q);
      if (!matchPlate && !matchRaw && !matchFile) return false;
    }
    if (helmetFilter !== 'all') {
      if (helmetFilter === 'violation' && !r.violation_candidate) return false;
      if (helmetFilter === 'helmet_detected' && r.helmet_status !== 'helmet_detected') return false;
      if (helmetFilter === 'no_helmet_detected' && r.helmet_status !== 'no_helmet_detected') return false;
      if (helmetFilter === 'uncertain' && r.association_status !== 'uncertain' && r.helmet_status !== 'uncertain') return false;
    }
    if (reviewFilter !== 'all') {
      if (reviewFilter === 'approved' && r.review_status !== 'approved') return false;
      if (reviewFilter === 'disapproved' && r.review_status !== 'disapproved') return false;
      if (reviewFilter === 'pending_review' && r.review_status !== 'pending_review') return false;
      if (reviewFilter === 'verified_violation' && r.review_status !== 'verified_violation') return false;
      if (reviewFilter === 'compliant' && r.review_status !== 'compliant') return false;
      if (reviewFilter === 'dismissed' && r.review_status !== 'dismissed') return false;
    }
    return true;
  });

  // Filter session history records
  const filteredHistory = history.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.filename.toLowerCase().includes(q) ||
        Object.keys(item.result.counts).some((k) => k.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (sessionApprovalFilter !== 'all') {
      const status = item.approval_status || 'pending';
      if (sessionApprovalFilter !== status) return false;
    }
    return true;
  });

  const handleOpenRecord = (record: (typeof history)[0]) => {
    loadHistoryRecord(record);
    navigate('/image-analysis');
  };

  const handleInspect = (record: ComplianceRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleUpdateReviewStatus = async (
    recordId: string,
    newStatus: ReviewStatus,
    notes?: string
  ) => {
    try {
      if (health.status === 'ok') {
        await updateRecordReviewStatus(settings.apiBaseUrl, recordId, newStatus, notes);
        await loadBackendRecords();
      }
      // Update local state
      setBackendRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, review_status: newStatus, review_notes: notes } : r
        )
      );
    } catch (err) {
      console.error('Failed to update review status:', err);
    }
  };

  // Export All data as JSON
  const handleExportJson = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      complianceRecordsCount: filteredCompliance.length,
      complianceRecords: filteredCompliance,
      sessionsCount: history.length,
      sessions: history.map((item) => ({
        id: item.id,
        analysisType: item.analysisType || 'image',
        filename: item.filename,
        timestamp: new Date(item.timestamp).toISOString(),
        approval_status: item.approval_status || 'pending',
        inference_time_ms: item.result.inference_time_ms,
        counts: item.result.counts,
        detections: item.result.detections,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadvision_history_all_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Approved-Only dataset as JSON
  const handleExportApprovedJson = () => {
    const approvedCompliance = allComplianceRecords.filter(
      (r) => r.review_status === 'approved' || r.review_status === 'verified_violation'
    );
    const approvedSessions = history
      .filter(
        (s) =>
          s.approval_status === 'approved' ||
          s.result.detections.some((d) => d.approval_status === 'approved')
      )
      .map((item) => ({
        id: item.id,
        filename: item.filename,
        timestamp: new Date(item.timestamp).toISOString(),
        session_approval: item.approval_status || 'pending',
        approved_detections_count: item.result.detections.filter(
          (d) => d.approval_status === 'approved'
        ).length,
        total_detections_count: item.result.detections.length,
        approved_detections: item.result.detections.filter(
          (d) => d.approval_status === 'approved'
        ),
      }));

    const exportData = {
      dataset_purpose: 'human_verified_approved_ground_truth',
      exported_at: new Date().toISOString(),
      approved_compliance_count: approvedCompliance.length,
      approved_compliance_records: approvedCompliance,
      approved_sessions_count: approvedSessions.length,
      approved_sessions: approvedSessions,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadvision_approved_dataset_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const approvedSessionsCount = history.filter((s) => s.approval_status === 'approved').length;
  const approvedComplianceCount = allComplianceRecords.filter((r) => r.review_status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Analysis History & Compliance Records
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Audit extracted license plates, approve or disapprove detections, and export curated datasets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {health.status === 'ok' && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadBackendRecords}
              isLoading={isLoadingBackend}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync DB
            </Button>
          )}

          {(history.length > 0 || allComplianceRecords.length > 0) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportApprovedJson}
                leftIcon={<FileCheck className="w-3.5 h-3.5 text-status-success" />}
                title="Export only approved records and verified detections for dataset training"
              >
                Export Approved ({(activeTab === 'compliance' ? approvedComplianceCount : approvedSessionsCount)})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export All
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={clearHistory}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Clear Session
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Switcher: Compliance Table vs Session Files */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('compliance')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
              activeTab === 'compliance'
                ? 'bg-accent-cyan text-background shadow-sm'
                : 'bg-background-secondary text-text-secondary hover:text-text-primary border border-border'
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Compliance Records ({filteredCompliance.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
              activeTab === 'sessions'
                ? 'bg-accent-cyan text-background shadow-sm'
                : 'bg-background-secondary text-text-secondary hover:text-text-primary border border-border'
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>Session Analyses ({filteredHistory.length})</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search registration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background-secondary border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>

          {activeTab === 'compliance' ? (
            <>
              <select
                value={helmetFilter}
                onChange={(e) => setHelmetFilter(e.target.value)}
                className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
              >
                <option value="all">All Helmet Statuses</option>
                <option value="violation">Violations Only</option>
                <option value="helmet_detected">Helmet Detected</option>
                <option value="no_helmet_detected">No Helmet</option>
                <option value="uncertain">Uncertain</option>
              </select>

              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
                className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
              >
                <option value="all">All Review States</option>
                <option value="approved">Approved</option>
                <option value="disapproved">Disapproved</option>
                <option value="pending_review">Pending Review</option>
                <option value="verified_violation">Verified Violation</option>
                <option value="compliant">Compliant</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </>
          ) : (
            <select
              value={sessionApprovalFilter}
              onChange={(e) => setSessionApprovalFilter(e.target.value)}
              className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value="all">All Approval States</option>
              <option value="approved">Approved</option>
              <option value="disapproved">Disapproved</option>
              <option value="pending">Pending</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: Number Plate & Helmet Compliance Table */}
      {activeTab === 'compliance' && (
        <Card>
          {filteredCompliance.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-xs space-y-2">
              <History className="w-10 h-10 text-text-muted mx-auto opacity-40 mb-1" />
              <p className="text-sm font-medium text-text-secondary">
                No compliance records match your filters.
              </p>
              <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                Completed analyses will record detected registration plates and associated helmet compliance status here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/70 text-text-muted font-medium">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Registration Number</th>
                    <th className="py-3 px-4">Helmet Status</th>
                    <th className="py-3 px-4 text-right">OCR Conf.</th>
                    <th className="py-3 px-4">Association</th>
                    <th className="py-3 px-4">Review Status</th>
                    <th className="py-3 px-4 text-center">Evidence</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCompliance.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleInspect(item)}
                      className="hover:bg-background-hover/50 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px] whitespace-nowrap">
                        {formatTime(new Date(item.timestamp).getTime())}
                      </td>

                      {/* Registration Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {item.ocr_status === 'recognized' ? (
                            <span className="font-mono font-bold text-text-primary tracking-wide text-xs">
                              {item.registration_number}
                            </span>
                          ) : item.ocr_status === 'unvalidated' ? (
                            <span className="font-mono text-text-secondary text-xs">
                              {item.registration_number || item.raw_ocr_text}
                            </span>
                          ) : item.ocr_status === 'no_plate' ? (
                            <span className="text-text-muted italic text-[11px]">
                              No plate
                            </span>
                          ) : (
                            <span className="text-status-warning/90 font-medium text-[11px]">
                              Unreadable plate
                            </span>
                          )}

                          {item.violation_candidate && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-status-error/15 text-status-error border border-status-error/30 font-semibold">
                              Violation
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Helmet Status */}
                      <td className="py-3 px-4">
                        {item.helmet_status === 'helmet_detected' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-success/10 text-status-success border border-status-success/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Helmet detected</span>
                          </span>
                        ) : item.helmet_status === 'no_helmet_detected' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-error/10 text-status-error border border-status-error/20">
                            <ShieldAlert className="w-3 h-3" />
                            <span>No helmet detected</span>
                          </span>
                        ) : item.helmet_status === 'uncertain' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Uncertain</span>
                          </span>
                        ) : (
                          <span className="text-text-muted text-[11px]">Not assessed</span>
                        )}
                      </td>

                      {/* OCR Confidence */}
                      <td className="py-3 px-4 text-right font-mono text-text-secondary text-xs">
                        {item.ocr_status === 'unreadable' || item.ocr_status === 'no_plate'
                          ? '—'
                          : formatConfidence(item.ocr_confidence)}
                      </td>

                      {/* Association Status */}
                      <td className="py-3 px-4">
                        {item.association_status === 'associated' ? (
                          <span className="text-status-success text-[11px] font-medium">
                            Associated
                          </span>
                        ) : item.association_status === 'uncertain' ? (
                          <span className="text-status-warning text-[11px] font-medium">
                            Uncertain
                          </span>
                        ) : (
                          <span className="text-text-muted text-[11px]">No rider</span>
                        )}
                      </td>

                      {/* Review Status */}
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            'text-[10px] px-2 py-0.5 rounded font-medium border whitespace-nowrap inline-flex items-center gap-1',
                            item.review_status === 'approved'
                              ? 'bg-status-success/15 text-status-success border-status-success/30'
                              : item.review_status === 'disapproved'
                              ? 'bg-status-error/15 text-status-error border-status-error/30'
                              : item.review_status === 'verified_violation'
                              ? 'bg-status-error/15 text-status-error border-status-error/30'
                              : item.review_status === 'compliant'
                              ? 'bg-status-success/15 text-status-success border-status-success/30'
                              : item.review_status === 'dismissed'
                              ? 'bg-background-hover text-text-muted border-border'
                              : 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20'
                          )}
                        >
                          {item.review_status === 'approved' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Approved
                            </>
                          ) : item.review_status === 'disapproved' ? (
                            <>
                              <XCircle className="w-3 h-3" />
                              Disapproved
                            </>
                          ) : item.review_status === 'verified_violation' ? (
                            'Verified'
                          ) : item.review_status === 'compliant' ? (
                            'Compliant'
                          ) : item.review_status === 'dismissed' ? (
                            'Dismissed'
                          ) : (
                            'Pending'
                          )}
                        </span>
                      </td>

                      {/* Evidence Preview */}
                      <td className="py-3 px-4 text-center">
                        {item.plate_crop_base64 ? (
                          <div className="w-10 h-5 bg-black/60 rounded border border-border mx-auto overflow-hidden flex items-center justify-center">
                            <img
                              src={`data:image/jpeg;base64,${item.plate_crop_base64}`}
                              alt="Plate crop"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <span className="text-text-muted text-[10px]">—</span>
                        )}
                      </td>

                      {/* Quick Review Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Approve record"
                            onClick={() => handleUpdateReviewStatus(item.id, 'approved')}
                            className={clsx(
                              'p-1.5 rounded text-xs transition-colors border',
                              item.review_status === 'approved'
                                ? 'bg-status-success text-background border-status-success'
                                : 'text-text-muted border-border hover:bg-status-success/15 hover:text-status-success hover:border-status-success/40'
                            )}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Disapprove record"
                            onClick={() => handleUpdateReviewStatus(item.id, 'disapproved')}
                            className={clsx(
                              'p-1.5 rounded text-xs transition-colors border',
                              item.review_status === 'disapproved'
                                ? 'bg-status-error text-white border-status-error'
                                : 'text-text-muted border-border hover:bg-status-error/15 hover:text-status-error hover:border-status-error/40'
                            )}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Inspect details"
                            onClick={() => handleInspect(item)}
                            className="px-2 py-1 rounded text-xs text-accent-cyan hover:bg-accent-cyan/10 transition-colors inline-flex items-center gap-1 font-medium ml-1"
                          >
                            <span>Inspect</span>
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: Session Analyses List with Object-Level Approvals */}
      {activeTab === 'sessions' && (
        <Card>
          <CardHeader
            title={`Completed Analyses (${filteredHistory.length})`}
            subtitle="Review full sessions or verify and approve individual detected objects"
          />

          {filteredHistory.length === 0 ? (
            <div className="py-14 text-center text-text-muted text-xs space-y-2">
              <History className="w-10 h-10 text-text-muted mx-auto opacity-40 mb-1" />
              <p className="text-sm font-medium text-text-secondary">
                No analyses match your criteria.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredHistory.map((item) => (
                <div key={item.id} className="py-4 px-3 space-y-3">
                  <div
                    onClick={() => handleOpenRecord(item)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-background-hover/40 p-2 rounded-lg transition-colors cursor-pointer group"
                  >
                    {/* Left: Thumbnail, Badge, & Filename */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-lg bg-black/60 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={item.originalImageUrl}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-text-primary truncate max-w-xs sm:max-w-md">
                            {sanitizeFilename(item.filename)}
                          </h4>

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 font-medium flex items-center gap-1">
                            {item.analysisType === 'video' ? (
                              <>
                                <Film className="w-3 h-3" />
                                <span>Video</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-3 h-3" />
                                <span>Image</span>
                              </>
                            )}
                          </span>

                          {/* Session Approval Status Badge */}
                          <span
                            className={clsx(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium border inline-flex items-center gap-1',
                              item.approval_status === 'approved'
                                ? 'bg-status-success/15 text-status-success border-status-success/30'
                                : item.approval_status === 'disapproved'
                                ? 'bg-status-error/15 text-status-error border-status-error/30'
                                : 'bg-background-secondary text-text-muted border-border'
                            )}
                          >
                            {item.approval_status === 'approved' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Approved
                              </>
                            ) : item.approval_status === 'disapproved' ? (
                              <>
                                <XCircle className="w-3 h-3" />
                                Disapproved
                              </>
                            ) : (
                              'Pending'
                            )}
                          </span>

                          {item.result.is_demo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-pink/15 text-accent-pink border border-accent-pink/30 font-medium">
                              Demo
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                          <span>{formatTime(item.timestamp)}</span>
                          <span>•</span>
                          <span>{formatFileSize(item.fileSize)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-text-secondary">
                            <Clock className="w-3 h-3" />
                            {formatDuration(item.result.inference_time_ms)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Approve/Disapprove Buttons & Object Inspector Toggle */}
                    <div
                      className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Session Level Approval Buttons */}
                      <button
                        title="Approve entire session (all detections)"
                        onClick={() => updateHistoryRecordApproval(item.id, 'approved')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1',
                          item.approval_status === 'approved'
                            ? 'bg-status-success text-background border-status-success'
                            : 'bg-background-secondary text-text-secondary border-border hover:border-status-success/50 hover:text-status-success'
                        )}
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>

                      <button
                        title="Disapprove entire session"
                        onClick={() => updateHistoryRecordApproval(item.id, 'disapproved')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1',
                          item.approval_status === 'disapproved'
                            ? 'bg-status-error text-white border-status-error'
                            : 'bg-background-secondary text-text-secondary border-border hover:border-status-error/50 hover:text-status-error'
                        )}
                      >
                        <X className="w-3 h-3" />
                        <span>Disapprove</span>
                      </button>

                      {/* Expand/Collapse Detected Objects */}
                      <button
                        onClick={() =>
                          setExpandedSessionId(expandedSessionId === item.id ? null : item.id)
                        }
                        className="px-2.5 py-1 rounded text-xs text-text-secondary hover:text-text-primary bg-background-secondary hover:bg-background-hover border border-border transition-colors flex items-center gap-1.5"
                      >
                        <Layers className="w-3 h-3 text-accent-cyan" />
                        <span>{item.result.detections.length} Objects</span>
                        {expandedSessionId === item.id ? (
                          <ChevronUp className="w-3 h-3 text-text-muted" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-text-muted" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenRecord(item)}
                        className="flex items-center gap-1 text-xs text-accent-cyan hover:text-accent-cyan/80 font-medium px-2.5 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 group-hover:bg-accent-cyan group-hover:text-background transition-colors"
                      >
                        <span>Reopen</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Object-by-Object Approval Inspection Panel */}
                  {expandedSessionId === item.id && (
                    <div className="mt-2 pt-2 border-t border-border bg-background-secondary/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-text-secondary font-medium pb-1 border-b border-border/50">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-accent-cyan" />
                          <span>Object Verifications ({item.result.detections.length})</span>
                        </span>
                        <span className="text-[11px] text-text-muted">
                          Manually approve or disapprove individual bounding boxes
                        </span>
                      </div>

                      {item.result.detections.length === 0 ? (
                        <p className="text-xs text-text-muted py-2 italic">
                          No objects detected in this frame.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {item.result.detections.map((det, idx) => {
                            const detId = det.id || `det_${idx}`;
                            return (
                              <div
                                key={detId}
                                className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border text-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <ClassBadge detectionClass={det.class_name} />
                                  <span className="font-mono text-text-secondary text-[11px]">
                                    {formatConfidence(det.confidence)}
                                  </span>
                                  {det.class_name === 'number_plate' && det.ocr?.text && (
                                    <span className="font-mono font-bold text-accent-cyan text-xs bg-black/40 px-1.5 py-0.5 rounded border border-border">
                                      {det.ocr.text}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-text-muted font-mono hidden md:inline">
                                    [{det.bbox.map((n) => Math.round(n)).join(', ')}]
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={clsx(
                                      'text-[10px] px-2 py-0.5 rounded border font-medium inline-flex items-center gap-1',
                                      det.approval_status === 'approved'
                                        ? 'bg-status-success/15 text-status-success border-status-success/30'
                                        : det.approval_status === 'disapproved'
                                        ? 'bg-status-error/15 text-status-error border-status-error/30'
                                        : 'bg-background-hover text-text-muted border-border'
                                    )}
                                  >
                                    {det.approval_status === 'approved' ? (
                                      <>
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        Approved
                                      </>
                                    ) : det.approval_status === 'disapproved' ? (
                                      <>
                                        <XCircle className="w-2.5 h-2.5" />
                                        Disapproved
                                      </>
                                    ) : (
                                      'Pending'
                                    )}
                                  </span>

                                  <button
                                    title="Approve this object detection"
                                    onClick={() =>
                                      updateDetectionApproval(item.id, detId, 'approved')
                                    }
                                    className={clsx(
                                      'p-1 rounded text-xs transition-colors border',
                                      det.approval_status === 'approved'
                                        ? 'bg-status-success text-background border-status-success'
                                        : 'text-text-muted border-border hover:text-status-success hover:border-status-success/40 hover:bg-status-success/10'
                                    )}
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    title="Disapprove this object detection"
                                    onClick={() =>
                                      updateDetectionApproval(item.id, detId, 'disapproved')
                                    }
                                    className={clsx(
                                      'p-1 rounded text-xs transition-colors border',
                                      det.approval_status === 'disapproved'
                                        ? 'bg-status-error text-white border-status-error'
                                        : 'text-text-muted border-border hover:text-status-error hover:border-status-error/40 hover:bg-status-error/10'
                                    )}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Inspect Evidence Modal */}
      <ComplianceInspectModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdateStatus={handleUpdateReviewStatus}
      />
    </div>
  );
};
