import React from 'react';
import { DetectionClass } from '@/types/detection';
import { DETECTION_CLASSES } from '@/utils/constants';
import { clsx } from 'clsx';

interface ClassBadgeProps {
  className?: string;
  detectionClass: DetectionClass | string;
  showDot?: boolean;
}

export const ClassBadge: React.FC<ClassBadgeProps> = ({
  detectionClass,
  className,
  showDot = true,
}) => {
  const config = DETECTION_CLASSES[detectionClass as DetectionClass] || {
    name: detectionClass as DetectionClass,
    displayName: detectionClass,
    color: '#8BE8FF',
    badgeClass: 'bg-cyan-500/10 text-accent-cyan border-cyan-500/30',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border select-none',
        config.badgeClass,
        className
      )}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: config.color }}
        />
      )}
      <span>{config.displayName}</span>
    </span>
  );
};
