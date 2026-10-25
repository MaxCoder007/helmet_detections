import React, { useState } from 'react';
import { DetectionItem, DetectionClass } from '@/types/detection';
import { ClassBadge } from './ClassBadge';
import { formatConfidence, formatBBox } from '@/utils/formatters';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Copy,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';

interface DetectionTableProps {
  detections: DetectionItem[];
  highlightedId: string | null;
  selectedId: string | null;
  onHoverDetection: (id: string | null) => void;
  onSelectDetection: (id: string | null) => void;
  activeFilterClass?: DetectionClass | 'all';
}

type SortField = 'confidence' | 'class_name' | 'index';
type SortDirection = 'asc' | 'desc';

export const DetectionTable: React.FC<DetectionTableProps> = ({
  detections,
  highlightedId,
  selectedId,
  onHoverDetection,
  onSelectDetection,
  activeFilterClass = 'all',
}) => {
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPlateId, setCopiedPlateId] = useState<string | null>(null);

  // Filter
  const filtered = detections.filter((item, index) => {
    if (activeFilterClass !== 'all' && item.class_name !== activeFilterClass) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesClass = item.class_name.toLowerCase().includes(q);
      const matchesIdx = String(index + 1).includes(q);
      const matchesPlate = Boolean(
        item.ocr?.text?.toLowerCase().includes(q) ||
        item.ocr?.raw_text?.toLowerCase().includes(q)
      );
      return matchesClass || matchesIdx || matchesPlate;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let comp = 0;
    if (sortField === 'confidence') {
      comp = a.confidence - b.confidence;
    } else if (sortField === 'class_name') {
      comp = a.class_name.localeCompare(b.class_name);
    } else if (sortField === 'index') {
      const idxA = detections.indexOf(a);
      const idxB = detections.indexOf(b);
      comp = idxA - idxB;
    }
    return sortDir === 'asc' ? comp : -comp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'confidence' ? 'desc' : 'asc');
    }
  };

  const handleCopyBBox = (e: React.MouseEvent, item: DetectionItem) => {
    e.stopPropagation();
    const str = formatBBox(item.bbox);
    navigator.clipboard.writeText(str);
    setCopiedId(item.id || 'item');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyPlate = (e: React.MouseEvent, item: DetectionItem) => {
    e.stopPropagation();
    if (item.ocr?.text) {
      navigator.clipboard.writeText(item.ocr.text);
      setCopiedPlateId(item.id || 'plate');
      setTimeout(() => setCopiedPlateId(null), 1500);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-accent-cyan" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent-cyan" />
    );
  };

  return (
    <div className="bg-background-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-background-muted/40">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Detection & OCR Results</h4>
          <p className="text-xs text-text-secondary mt-0.5">
            Showing {sorted.length} of {detections.length} objects • YOLO11n detection with EasyOCR plate recognition
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search class, plate, #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
          />
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-background-muted/60 text-text-secondary select-none">
              <th
                onClick={() => toggleSort('index')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary w-12 text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>#</span>
                  {renderSortIcon('index')}
                </div>
              </th>

              <th
                onClick={() => toggleSort('class_name')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary w-32"
              >
                <div className="flex items-center gap-1.5">
                  <span>Class</span>
                  {renderSortIcon('class_name')}
                </div>
              </th>

              <th
                onClick={() => toggleSort('confidence')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary w-40"
              >
                <div className="flex items-center gap-1.5">
                  <span>YOLO Conf</span>
                  {renderSortIcon('confidence')}
                </div>
              </th>

              <th className="py-2.5 px-3 font-semibold min-w-[220px]">
                <span>Number Plate OCR Recognition</span>
              </th>

              <th className="py-2.5 px-3 font-semibold">Bounding Box [x1, y1, x2, y2]</th>

              <th className="py-2.5 px-3 font-semibold text-right w-16">Inspect</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-muted">
                  No detections matching current filter or search criteria.
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const globalIndex = detections.indexOf(item) + 1;
                const isHovered = item.id === highlightedId;
                const isSelected = item.id === selectedId;
                const isPlate = item.class_name === 'number_plate';
                const ocr = item.ocr;

                return (
                  <React.Fragment key={item.id || globalIndex}>
                    <tr
                      onMouseEnter={() => onHoverDetection(item.id || null)}
                      onMouseLeave={() => onHoverDetection(null)}
                      onClick={() => onSelectDetection(item.id || null)}
                      className={clsx(
                        'transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-accent-cyan/10 font-medium'
                          : isHovered
                          ? 'bg-background-hover'
                          : 'hover:bg-background-hover/50'
                      )}
                    >
                      <td className="py-3 px-3 font-mono text-text-muted text-center">
                        {String(globalIndex).padStart(2, '0')}
                      </td>

                      <td className="py-3 px-3">
                        <ClassBadge detectionClass={item.class_name} />
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-background-hover rounded-full h-1.5 overflow-hidden shrink-0">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                item.confidence >= 0.75
                                  ? 'bg-status-success'
                                  : item.confidence >= 0.40
                                  ? 'bg-status-warning'
                                  : item.confidence >= 0.25
                                  ? 'bg-amber-400'
                                  : 'bg-status-error/80'
                              )}
                              style={{ width: `${Math.max(3, Math.round(item.confidence * 100))}%` }}
                            />
                          </div>
                          <span className="font-mono font-medium text-text-primary whitespace-nowrap">
                            {formatConfidence(item.confidence)}
                          </span>
                        </div>
                      </td>

                      {/* OCR Plate Recognition Column */}
                      <td className="py-3 px-3">
                        {isPlate ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {ocr?.status === 'success' && ocr.text ? (
                              <>
                                <span className="font-mono font-bold text-accent-cyan bg-accent-cyan/15 px-2 py-0.5 rounded border border-accent-cyan/30 text-xs tracking-wider">
                                  {ocr.text}
                                </span>

                                <button
                                  onClick={(e) => handleCopyPlate(e, item)}
                                  className="p-1 hover:text-text-primary text-text-muted rounded hover:bg-background-secondary"
                                  title="Copy registration number"
                                >
                                  {copiedPlateId === item.id ? (
                                    <Check className="w-3 h-3 text-status-success" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>

                                {ocr.confidence !== null && ocr.confidence !== undefined && (
                                  <span className="font-mono text-[11px] text-text-muted">
                                    {Math.round(ocr.confidence * 100)}% conf
                                  </span>
                                )}

                                {ocr.format_valid === true ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-medium"
                                    title={`Valid Indian registration format: ${ocr.format_type || 'standard'}`}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>Valid Pattern</span>
                                  </span>
                                ) : ocr.format_valid === false ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium"
                                    title={`Plausible or unverified format: ${ocr.format_type || 'unverified'}`}
                                  >
                                    <HelpCircle className="w-2.5 h-2.5" />
                                    <span>Unverified Pattern</span>
                                  </span>
                                ) : null}
                              </>
                            ) : ocr?.status === 'unreadable' ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-background-secondary text-text-muted border border-border"
                                title={ocr.notes || 'Characters could not be extracted (blurred, occluded, or low resolution)'}
                              >
                                <AlertCircle className="w-3 h-3 text-text-muted" />
                                <span>Unreadable Plate</span>
                              </span>
                            ) : ocr?.status === 'error' ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-status-error/15 text-status-error border border-status-error/30"
                                title={ocr.notes || 'OCR engine exception'}
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span>OCR Error</span>
                              </span>
                            ) : (
                              <span className="text-text-muted text-[11px]">Processing OCR...</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-text-secondary text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span>{formatBBox(item.bbox)}</span>
                          <button
                            onClick={(e) => handleCopyBBox(e, item)}
                            className="p-1 hover:text-text-primary text-text-muted rounded"
                            title="Copy bounding box coordinates"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-status-success" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDetection(isSelected ? null : item.id || null);
                          }}
                          className={clsx(
                            'p-1.5 rounded-md text-xs transition-colors',
                            isSelected
                              ? 'bg-accent-cyan text-background font-semibold'
                              : 'text-text-secondary hover:text-accent-cyan hover:bg-background-hover'
                          )}
                          title="Highlight on image"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Detailed Card for Selected Plate Detection */}
                    {isSelected && isPlate && ocr && (
                      <tr className="bg-accent-cyan/5 border-b border-border">
                        <td colSpan={6} className="p-3">
                          <div className="bg-background-secondary rounded-lg p-3 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-accent-cyan" />
                                  <span>Number Plate OCR Details:</span>
                                </span>
                                <span className="font-mono text-text-secondary">
                                  {ocr.text || 'Unreadable'}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-muted flex flex-wrap gap-x-4 gap-y-1">
                                <span>Detected: <strong className="text-text-primary">Yes</strong></span>
                                <span>YOLO Conf: <strong className="text-text-primary">{formatConfidence(item.confidence)}</strong></span>
                                <span>OCR Conf: <strong className="text-text-primary">{ocr.confidence !== null && ocr.confidence !== undefined ? `${Math.round(ocr.confidence * 100)}%` : 'N/A'}</strong></span>
                                <span>Format Check: <strong className="text-text-primary">{ocr.format_valid ? 'Valid Indian Pattern' : ocr.format_type === 'unreadable' ? 'Unreadable' : 'Unverified Pattern'}</strong></span>
                                {ocr.notes && <span>Notes: <span className="text-text-secondary">{ocr.notes}</span></span>}
                              </div>
                            </div>

                            {ocr.crop_base64 && (
                              <div className="shrink-0 flex items-center gap-2 bg-black/40 p-1.5 rounded border border-border">
                                <span className="text-[10px] text-text-muted">Crop:</span>
                                <img
                                  src={`data:image/jpeg;base64,${ocr.crop_base64}`}
                                  alt="Plate crop"
                                  className="h-7 w-auto object-contain rounded"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer info note */}
      <div className="p-3 bg-background-muted/40 border-t border-border text-[11px] text-text-muted flex items-center justify-between">
        <span>YOLO11n detected {detections.length} total objects; OCR executed on number_plate regions.</span>
        <span>{detections.filter((d) => d.class_name === 'number_plate').length} number plates</span>
      </div>
    </div>
  );
};
