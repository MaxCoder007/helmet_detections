import React from 'react';
import { ClassCounts, DetectionClass } from '@/types/detection';
import { DETECTION_CLASSES } from '@/utils/constants';
import { ShieldCheck, ShieldAlert, CreditCard, Users, User, Filter } from 'lucide-react';
import { clsx } from 'clsx';

interface DetectionSummaryProps {
  counts: ClassCounts;
  totalDetections: number;
  activeFilter?: DetectionClass | 'all';
  onFilterChange?: (filterClass: DetectionClass | 'all') => void;
}

export const DetectionSummary: React.FC<DetectionSummaryProps> = ({
  counts,
  totalDetections,
  activeFilter = 'all',
  onFilterChange,
}) => {
  const classOrder: DetectionClass[] = ['helmet', 'no_helmet', 'number_plate', 'rider', 'pillion'];

  const getIcon = (className: DetectionClass) => {
    switch (className) {
      case 'helmet':
        return <ShieldCheck className="w-4 h-4 text-detection-helmet" />;
      case 'no_helmet':
        return <ShieldAlert className="w-4 h-4 text-detection-no_helmet" />;
      case 'number_plate':
        return <CreditCard className="w-4 h-4 text-detection-number_plate" />;
      case 'rider':
        return <User className="w-4 h-4 text-detection-rider" />;
      case 'pillion':
        return <Users className="w-4 h-4 text-detection-pillion" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <span>Class Breakdown</span>
          <span className="text-[10px] text-text-muted">({totalDetections} total)</span>
        </h4>

        {activeFilter !== 'all' && onFilterChange && (
          <button
            onClick={() => onFilterChange('all')}
            className="text-[11px] text-accent-cyan hover:underline flex items-center gap-1"
          >
            <Filter className="w-3 h-3" />
            <span>Reset filter</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {classOrder.map((cls) => {
          const config = DETECTION_CLASSES[cls];
          const count = counts[cls] || 0;
          const isSelected = activeFilter === cls;

          return (
            <div
              key={cls}
              onClick={() => onFilterChange && onFilterChange(isSelected ? 'all' : cls)}
              className={clsx(
                'rounded-xl p-3 border transition-all duration-200 cursor-pointer select-none relative overflow-hidden',
                isSelected
                  ? 'bg-background-hover border-accent-cyan shadow-sm ring-1 ring-accent-cyan/50'
                  : 'bg-background-card border-border hover:border-border-active hover:bg-background-hover/70'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="p-1.5 rounded-lg bg-background-hover/80 border border-border">
                  {getIcon(cls)}
                </span>
                <span className="font-mono text-xl font-bold text-text-primary tracking-tight">
                  {count}
                </span>
              </div>

              <div className="mt-1">
                <div className="text-xs font-medium text-text-primary truncate">
                  {config.displayName}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {totalDetections > 0
                    ? `${Math.round((count / totalDetections) * 100)}% of detections`
                    : '0%'}
                </div>
              </div>

              {/* Bottom colored indicator bar */}
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 opacity-80"
                style={{ backgroundColor: config.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
