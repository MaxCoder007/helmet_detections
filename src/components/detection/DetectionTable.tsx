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

  // Filter
  const filtered = detections.filter((item, index) => {
    if (activeFilterClass !== 'all' && item.class_name !== activeFilterClass) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesClass = item.class_name.toLowerCase().includes(q);
      const matchesIdx = String(index + 1).includes(q);
      return matchesClass || matchesIdx;
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
          <h4 className="text-sm font-semibold text-text-primary">Detection Table</h4>
          <p className="text-xs text-text-secondary mt-0.5">
            Showing {sorted.length} of {detections.length} objects • Model confidence score
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-48">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search detections..."
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
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-text-primary w-16"
              >
                <div className="flex items-center gap-1.5">
                  <span>#</span>
                  {renderSortIcon('index')}
                </div>
              </th>

              <th
                onClick={() => toggleSort('class_name')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-text-primary"
              >
                <div className="flex items-center gap-1.5">
                  <span>Class</span>
                  {renderSortIcon('class_name')}
                </div>
              </th>

              <th
                onClick={() => toggleSort('confidence')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-text-primary"
              >
                <div className="flex items-center gap-1.5">
                  <span>Confidence</span>
                  {renderSortIcon('confidence')}
                </div>
              </th>

              <th className="py-2.5 px-4 font-semibold">Bounding Box [x1, y1, x2, y2]</th>

              <th className="py-2.5 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-muted">
                  No detections matching current filter or search criteria.
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const globalIndex = detections.indexOf(item) + 1;
                const isHovered = item.id === highlightedId;
                const isSelected = item.id === selectedId;

                return (
                  <tr
                    key={item.id || globalIndex}
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
                    <td className="py-3 px-4 font-mono text-text-muted">
                      {String(globalIndex).padStart(2, '0')}
                    </td>

                    <td className="py-3 px-4">
                      <ClassBadge detectionClass={item.class_name} />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-background-hover rounded-full h-1.5 overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              item.confidence >= 0.85
                                ? 'bg-status-success'
                                : item.confidence >= 0.6
                                ? 'bg-status-warning'
                                : 'bg-status-error'
                            )}
                            style={{ width: `${Math.round(item.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-medium text-text-primary">
                          {formatConfidence(item.confidence)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-text-secondary text-[11px]">
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

                    <td className="py-3 px-4 text-right">
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer info note */}
      <div className="p-3 bg-background-muted/40 border-t border-border text-[11px] text-text-muted flex items-center justify-between">
        <span>Confidence represents the model prediction certainty (YOLO11n).</span>
        <span>{detections.length} objects detected</span>
      </div>
    </div>
  );
};
