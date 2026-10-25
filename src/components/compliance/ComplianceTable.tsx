import React, { useState } from 'react';
import { ComplianceRecord, ReviewStatus } from '@/types/detection';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Eye,
  CheckCircle2,
  Search,
  Download,
} from 'lucide-react';
import { formatConfidence } from '@/utils/formatters';
import { downloadComplianceRecord } from '@/utils/exportUtils';
import { ComplianceInspectModal } from './ComplianceInspectModal';

interface ComplianceTableProps {
  records: ComplianceRecord[];
  onUpdateStatus?: (recordId: string, status: ReviewStatus, notes?: string) => Promise<void>;
  showFilters?: boolean;
}

export const ComplianceTable: React.FC<ComplianceTableProps> = ({
  records,
  onUpdateStatus,
  showFilters = false,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<ComplianceRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRecords = records.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlate = r.registration_number?.toLowerCase().includes(q);
      const matchRaw = r.raw_ocr_text?.toLowerCase().includes(q);
      if (!matchPlate && !matchRaw) return false;
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'violation' && !r.violation_candidate) return false;
      if (statusFilter === 'helmet_detected' && r.helmet_status !== 'helmet_detected') return false;
      if (statusFilter === 'no_helmet_detected' && r.helmet_status !== 'no_helmet_detected') return false;
      if (statusFilter === 'uncertain' && r.association_status !== 'uncertain' && r.helmet_status !== 'uncertain') return false;
    }
    return true;
  });

  const handleInspect = (record: ComplianceRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  if (!records || records.length === 0) {
    return (
      <div className="bg-background-card border border-border rounded-xl p-6 text-center text-xs text-text-muted">
        <CheckCircle2 className="w-8 h-8 text-status-success mx-auto opacity-70 mb-2" />
        <h4 className="text-sm font-semibold text-text-primary">
          No Number Plates or Riders Identified
        </h4>
        <p className="mt-1 text-text-secondary max-w-sm mx-auto">
          No number plates or associated motorcycle riders were detected in this analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-secondary/40">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Number Plate Recognition & Helmet Compliance
          </h3>
          <p className="text-[11px] text-text-secondary mt-0.5">
            OCR-extracted vehicle registration numbers associated with motorcycle safety status
          </p>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registration..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-secondary border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan w-40"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value="all">All Records</option>
              <option value="violation">Violations Only</option>
              <option value="helmet_detected">Helmet Detected</option>
              <option value="no_helmet_detected">No Helmet</option>
              <option value="uncertain">Uncertain / Ambiguous</option>
            </select>
          </div>
        )}
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-background-secondary/70 text-text-muted font-medium">
              <th className="py-3 px-4">Registration Number</th>
              <th className="py-3 px-4">Helmet Status</th>
              <th className="py-3 px-4 text-right">OCR Conf.</th>
              <th className="py-3 px-4 text-right">Helmet Conf.</th>
              <th className="py-3 px-4">Association Status</th>
              <th className="py-3 px-4">Status & Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-muted text-xs">
                  No records match your search filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-background-hover/50 transition-colors cursor-pointer group"
                  onClick={() => handleInspect(item)}
                >
                  {/* Registration Number & Crop Thumbnail */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      {item.plate_crop_base64 ? (
                        <div className="w-12 h-6 bg-black/60 rounded border border-border overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            src={`data:image/jpeg;base64,${item.plate_crop_base64}`}
                            alt="Plate crop"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : null}

                      <div>
                        {item.ocr_status === 'recognized' ? (
                          <span className="font-mono font-bold text-text-primary tracking-wide text-xs">
                            {item.registration_number}
                          </span>
                        ) : item.ocr_status === 'unvalidated' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-text-secondary text-xs">
                              {item.registration_number || item.raw_ocr_text}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 rounded bg-status-warning/15 text-status-warning border border-status-warning/30">
                              Unvalidated
                            </span>
                          </div>
                        ) : item.ocr_status === 'no_plate' ? (
                          <span className="text-text-muted italic text-[11px]">
                            No plate visible
                          </span>
                        ) : (
                          <span className="text-status-warning/90 font-medium text-[11px]">
                            Unreadable plate
                          </span>
                        )}

                        {item.raw_ocr_text && item.ocr_status !== 'recognized' && (
                          <p className="text-[10px] text-text-muted font-mono truncate max-w-[120px]">
                            "{item.raw_ocr_text}"
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Helmet Status */}
                  <td className="py-3 px-4">
                    {item.helmet_status === 'helmet_detected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-status-success/10 text-status-success border border-status-success/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Helmet detected</span>
                      </span>
                    ) : item.helmet_status === 'no_helmet_detected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-status-error/10 text-status-error border border-status-error/20">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>No helmet detected</span>
                      </span>
                    ) : item.helmet_status === 'uncertain' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
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

                  {/* Helmet Detection Confidence */}
                  <td className="py-3 px-4 text-right font-mono text-text-secondary text-xs">
                    {item.helmet_confidence > 0
                      ? formatConfidence(item.helmet_confidence)
                      : '—'}
                  </td>

                  {/* Association Status */}
                  <td className="py-3 px-4">
                    {item.association_status === 'associated' ? (
                      <span className="text-status-success text-[11px] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Associated</span>
                      </span>
                    ) : item.association_status === 'uncertain' ? (
                      <span className="text-status-warning text-[11px] font-medium flex items-center gap-1" title="Ambiguous multi-rider proximity">
                        <HelpCircle className="w-3 h-3" />
                        <span>Association uncertain</span>
                      </span>
                    ) : (
                      <span className="text-text-muted text-[11px]">No rider</span>
                    )}
                  </td>

                  {/* Status & Action */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {item.violation_candidate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-error/15 text-status-error border border-status-error/30 font-semibold whitespace-nowrap">
                          Violation
                        </span>
                      )}

                      {item.review_required && !item.violation_candidate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-warning/15 text-status-warning border border-status-warning/30 font-medium whitespace-nowrap">
                          Review
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadComplianceRecord(item, 'json');
                          }}
                          className="p-1 rounded text-text-muted hover:text-accent-cyan hover:bg-background-hover transition-colors"
                          title="Download this compliance record dossier (JSON)"
                        >
                          <Download className="w-3.5 h-3.5 text-accent-cyan" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(item);
                          }}
                          className="p-1 rounded text-text-muted hover:text-accent-cyan hover:bg-background-hover transition-colors"
                          title="Inspect evidence details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-background-muted/40 border-t border-border text-[11px] text-text-muted flex items-center justify-between">
        <span>
          Violations are flagged as candidates only when rider-to-plate association is verified.
        </span>
        <span>{filteredRecords.length} record(s)</span>
      </div>

      {/* Inspection Modal */}
      <ComplianceInspectModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
};
