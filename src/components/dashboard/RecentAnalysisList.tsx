import React from 'react';
import { HistoryRecord } from '@/types/detection';
import { formatTime, formatDuration, sanitizeFilename } from '@/utils/formatters';
import { ArrowRight, Image as ImageIcon, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDetection } from '@/context/DetectionContext';

interface RecentAnalysisListProps {
  records: HistoryRecord[];
}

export const RecentAnalysisList: React.FC<RecentAnalysisListProps> = ({ records }) => {
  const navigate = useNavigate();
  const { loadHistoryRecord } = useDetection();

  if (records.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-xs border border-dashed border-border rounded-xl">
        <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
        <p>No analyses conducted in this session yet.</p>
        <p className="mt-1 text-[11px]">Upload an image to start detecting.</p>
      </div>
    );
  }

  const handleOpenRecord = (record: HistoryRecord) => {
    loadHistoryRecord(record);
    navigate('/detect');
  };

  return (
    <div className="space-y-2">
      {records.slice(0, 5).map((record) => {
        const total = record.result.detections.length;
        const violations = record.result.counts.no_helmet || 0;

        return (
          <div
            key={record.id}
            onClick={() => handleOpenRecord(record)}
            className="flex items-center justify-between p-3 rounded-lg bg-background-card hover:bg-background-hover border border-border transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-lg bg-black/50 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={record.originalImageUrl}
                  alt={record.filename}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-semibold text-text-primary truncate max-w-[150px] sm:max-w-xs">
                    {sanitizeFilename(record.filename)}
                  </h5>
                  {record.result.is_demo && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent-pink/15 text-accent-pink border border-accent-pink/30">
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted mt-1">
                  <span>{formatTime(record.timestamp)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {formatDuration(record.result.inference_time_ms)}
                  </span>
                </div>
              </div>
            </div>

            {/* Counts & Action */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-background-hover border border-border text-text-primary">
                  {total} objects
                </span>
                {violations > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-status-error/15 border border-status-error/30 text-status-error">
                    {violations} violation{violations > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <span className="text-text-muted group-hover:text-accent-cyan transition-colors">
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
