import React, { useState, useEffect, useCallback } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ViolationRecord,
  ViolationStats,
} from '@/types/violation';
import { fetchViolations, getEvidenceUrl, getExportViolationsUrl } from '@/services/violationApi';
import { ViolationEvidenceModal } from '@/components/violations/ViolationEvidenceModal';
import { formatTime } from '@/utils/formatters';
import { downloadAllViolations, downloadViolationRecord } from '@/utils/exportUtils';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  FileCheck,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';

export const ViolationsPage: React.FC = () => {
  const { settings } = useDetection();

  const [records, setRecords] = useState<ViolationRecord[]>([]);
  const [stats, setStats] = useState<ViolationStats>({
    total_violations: 0,
    recognized_vehicles: 0,
    unidentified_vehicles: 0,
    pending_reviews: 0,
    reviewed_records: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [searchReg, setSearchReg] = useState('');
  const [ocrFilter, setOcrFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [assocFilter, setAssocFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal State
  const [selectedViolation, setSelectedViolation] = useState<ViolationRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadViolations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchViolations(settings.apiBaseUrl, {
        limit,
        offset,
        registration: searchReg.trim() || undefined,
        ocr_status: ocrFilter,
        review_status: reviewFilter,
        association_status: assocFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRecords(data.records);
      setTotalCount(data.total);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Failed to load violations:', err);
      setError(err.message || 'Failed to fetch violation records from database.');
    } finally {
      setIsLoading(false);
    }
  }, [
    settings.apiBaseUrl,
    limit,
    offset,
    searchReg,
    ocrFilter,
    reviewFilter,
    assocFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadViolations();
  }, [loadViolations]);

  const handleResetFilters = () => {
    setSearchReg('');
    setOcrFilter('all');
    setReviewFilter('all');
    setAssocFilter('all');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };

  const handleRecordUpdated = (updated: ViolationRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedViolation && selectedViolation.id === updated.id) {
      setSelectedViolation(updated);
    }
    // Refresh stats
    loadViolations();
  };

  const handleExportAll = (format: 'csv' | 'json') => {
    try {
      const url = getExportViolationsUrl(
        settings.apiBaseUrl,
        {
          registration: searchReg.trim() || undefined,
          ocr_status: ocrFilter,
          review_status: reviewFilter,
          association_status: assocFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        format
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadvision_violations_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      downloadAllViolations(records, format);
    }
  };

  const handleDownloadRecord = (
    e: React.MouseEvent,
    record: ViolationRecord,
    format: 'json' | 'csv' = 'json'
  ) => {
    e.stopPropagation();
    downloadViolationRecord(record, format);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red">
              <ShieldAlert className="w-6 h-6" />
            </div>
            Number Plate Violation Register
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Persistent audit ledger of detected motorcycle headwear violations, vehicle registration associations, and evidence imagery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download all data options */}
          <div className="flex items-center rounded-lg border border-border bg-background-card overflow-hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportAll('csv')}
              title="Download all matching violations as CSV spreadsheet"
              className="flex items-center gap-1.5 border-r border-border rounded-r-none text-xs hover:text-accent-green"
            >
              <Download className="w-3.5 h-3.5 text-accent-green" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportAll('json')}
              title="Download all matching violations as JSON database dump"
              className="flex items-center gap-1.5 rounded-l-none text-xs hover:text-accent-cyan"
            >
              <Download className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Export JSON</span>
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadViolations}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Violations */}
        <Card className="p-4 bg-background-secondary border-border flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Total Violations</p>
            <h3 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.total_violations}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Persistent database records</p>
          </div>
        </Card>

        {/* Card 2: Recognized Registration Numbers */}
        <Card className="p-4 bg-background-secondary border-border flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Recognized Plates</p>
            <h3 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.recognized_vehicles}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Valid / verified registrations</p>
          </div>
        </Card>

        {/* Card 3: Unidentified Vehicles */}
        <Card className="p-4 bg-background-secondary border-border flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Unidentified Vehicles</p>
            <h3 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.unidentified_vehicles}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Unreadable or plate missing</p>
          </div>
        </Card>

        {/* Card 4: Records Pending Review */}
        <Card className="p-4 bg-background-secondary border-border flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Pending Review</p>
            <h3 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.pending_reviews}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Awaiting human review</p>
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-background-secondary border-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-accent-cyan" />
            Filter Violation Records
          </span>
          <button
            onClick={handleResetFilters}
            className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search by plate */}
          <div className="relative">
            <input
              type="text"
              value={searchReg}
              onChange={(e) => {
                setSearchReg(e.target.value);
                setOffset(0);
              }}
              placeholder="Search registration..."
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-cyan"
            />
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
          </div>

          {/* OCR Status filter */}
          <div>
            <select
              value={ocrFilter}
              onChange={(e) => {
                setOcrFilter(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value="all">OCR Status: All</option>
              <option value="recognized">Recognized</option>
              <option value="unreadable">Unreadable</option>
              <option value="plate_not_detected">Plate Not Detected</option>
            </select>
          </div>

          {/* Review Status filter */}
          <div>
            <select
              value={reviewFilter}
              onChange={(e) => {
                setReviewFilter(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value="all">Review Status: All</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Association Status filter */}
          <div>
            <select
              value={assocFilter}
              onChange={(e) => {
                setAssocFilter(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value="all">Association: All</option>
              <option value="confirmed">Confirmed</option>
              <option value="uncertain">Uncertain</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2 py-1 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
              title="From Date"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2 py-1 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
              title="To Date"
            />
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-accent-red/10 border border-accent-red/30 text-sm text-accent-red flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadViolations}>
            Retry
          </Button>
        </div>
      )}

      {/* Violations Table */}
      <Card className="bg-background-secondary border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-background border-b border-border text-text-secondary uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Violation ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Registration</th>
                <th className="py-3 px-4">OCR Status</th>
                <th className="py-3 px-4">Vehicle Assoc.</th>
                <th className="py-3 px-4">Evidence</th>
                <th className="py-3 px-4">Review State</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-accent-cyan" />
                    Loading violation ledger...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-text-muted" />
                    No violation records match the active filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const hasManual = Boolean(r.manual_registration_number);
                  const displayReg = r.manual_registration_number || r.registration_number;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-background/60 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedViolation(r);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-medium text-text-primary">
                        {r.id}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                        {formatTime(r.violation_timestamp)}
                      </td>

                      {/* Registration */}
                      <td className="py-3 px-4 font-mono">
                        {displayReg ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-primary bg-background px-2 py-0.5 rounded border border-border">
                              {displayReg}
                            </span>
                            {hasManual && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[10px] bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                                title="Manually verified/corrected"
                              >
                                Manual
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted italic">Unidentified</span>
                        )}
                      </td>

                      {/* OCR Status */}
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-medium inline-block',
                            r.ocr_status === 'recognized'
                              ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                              : r.ocr_status === 'unreadable'
                              ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
                              : 'bg-text-muted/10 text-text-muted border border-border'
                          )}
                        >
                          {r.ocr_status === 'plate_not_detected'
                            ? 'Plate Not Detected'
                            : r.ocr_status.toUpperCase()}
                        </span>
                      </td>

                      {/* Vehicle Association */}
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-medium inline-block',
                            r.vehicle_association_status === 'confirmed'
                              ? 'bg-accent-cyan/10 text-accent-cyan'
                              : r.vehicle_association_status === 'uncertain'
                              ? 'bg-accent-amber/10 text-accent-amber'
                              : 'bg-text-muted/10 text-text-muted'
                          )}
                        >
                          {r.vehicle_association_status}
                        </span>
                      </td>

                      {/* Evidence Preview */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {r.plate_crop_path ? (
                            <img
                              src={getEvidenceUrl(settings.apiBaseUrl, r.id, 'number_plate')}
                              alt="Plate crop"
                              className="w-12 h-6 object-cover rounded border border-border bg-black/40"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : r.rider_crop_path ? (
                            <img
                              src={getEvidenceUrl(settings.apiBaseUrl, r.id, 'rider')}
                              alt="Rider crop"
                              className="w-8 h-8 object-cover rounded border border-border bg-black/40"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-text-muted text-[11px] italic">No crop</span>
                          )}
                        </div>
                      </td>

                      {/* Review State */}
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-medium capitalize',
                            r.review_status === 'resolved'
                              ? 'bg-accent-green/10 text-accent-green'
                              : r.review_status === 'reviewed'
                              ? 'bg-accent-cyan/10 text-accent-cyan'
                              : 'bg-accent-amber/10 text-accent-amber'
                          )}
                        >
                          {r.review_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => handleDownloadRecord(e, r, 'json')}
                            title="Download Violation Record Dossier (JSON)"
                            className="flex items-center gap-1 text-[11px] py-1 px-2 text-text-secondary hover:text-accent-cyan"
                          >
                            <Download className="w-3.5 h-3.5 text-accent-cyan" />
                            <span className="hidden sm:inline">Export</span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedViolation(r);
                              setIsModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-[11px] py-1 px-2.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 bg-background border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span>
              Showing {totalCount > 0 ? offset + 1 : 0} to {Math.min(offset + limit, totalCount)} of{' '}
              {totalCount} records
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              className="ml-2 px-2 py-1 bg-background-secondary border border-border rounded text-xs text-text-primary"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset <= 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="p-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + limit >= totalCount}
              onClick={() => setOffset(offset + limit)}
              className="p-1.5"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Evidence & Manual Review Modal */}
      <ViolationEvidenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        violation={selectedViolation}
        baseUrl={settings.apiBaseUrl}
        onRecordUpdated={handleRecordUpdated}
      />
    </div>
  );
};
