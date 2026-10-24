import React, { useState } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  formatTime,
  formatDuration,
  formatFileSize,
  sanitizeFilename,
} from '@/utils/formatters';
import {
  History,
  Trash2,
  Download,
  ArrowRight,
  Info,
  Clock,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  const { history, clearHistory, loadHistoryRecord } = useDetection();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = history.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.filename.toLowerCase().includes(q) ||
      Object.keys(item.result.counts).some((k) => k.toLowerCase().includes(q))
    );
  });

  const handleOpenRecord = (record: (typeof history)[0]) => {
    loadHistoryRecord(record);
    navigate('/detect');
  };

  const handleExportJson = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      totalRecords: history.length,
      records: history.map((item) => ({
        id: item.id,
        filename: item.filename,
        timestamp: new Date(item.timestamp).toISOString(),
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
    a.download = `roadvision_session_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Session Detection History
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Browse and review images evaluated during your active browser session
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export JSON
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

      {/* Clear Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-background-card border border-border flex items-start gap-3 text-xs text-text-secondary">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-text-primary">Session Storage Notice: </span>
          History records and image object URLs are held temporarily in client browser memory for this session and will reset when you refresh or close the tab. Images are never uploaded or permanently stored on external servers without your explicit consent.
        </div>
      </div>

      {/* History Items Container */}
      <Card>
        <CardHeader
          title={`Session Records (${history.length})`}
          subtitle="Click on any item to reload the analysis into the interactive workspace"
          action={
            history.length > 0 && (
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background-secondary border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
                />
              </div>
            )
          }
        />

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-xs">
            <History className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium text-text-secondary">No records in this session</p>
            <p className="mt-1 text-xs">
              Upload images in the Detection Workspace to populate your session log.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenRecord(item)}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-background-hover/50 p-3 rounded-lg transition-colors cursor-pointer group"
              >
                {/* Left: Thumbnail & Filename */}
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

                {/* Right: Class Counts Chips & Action */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.result.counts.helmet > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/30 font-medium">
                        {item.result.counts.helmet} Helmet
                      </span>
                    )}

                    {item.result.counts.no_helmet > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-error/10 text-status-error border border-status-error/30 font-medium">
                        {item.result.counts.no_helmet} No Helmet
                      </span>
                    )}

                    {item.result.counts.number_plate > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 font-medium">
                        {item.result.counts.number_plate} Plate
                      </span>
                    )}

                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-background-hover border border-border text-text-secondary font-mono">
                      {item.result.detections.length} total
                    </span>
                  </div>

                  <span className="p-1 text-text-muted group-hover:text-accent-cyan transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
