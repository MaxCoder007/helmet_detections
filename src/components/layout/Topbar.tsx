import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw } from 'lucide-react';
import { useDetection } from '@/context/DetectionContext';
import { clsx } from 'clsx';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { health, checkHealth } = useDetection();
  const [isChecking, setIsChecking] = useState(false);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Overview';
      case '/image-analysis':
      case '/detect':
        return 'Image Analysis';
      case '/video-analysis':
      case '/video':
        return 'Video Analysis';
      case '/live-analysis':
      case '/live-video':
        return 'Live Video Analysis';
      case '/history':
        return 'Analysis History';
      default:
        return 'RoadVision AI';
    }
  };

  const handleManualHealthCheck = async () => {
    setIsChecking(true);
    await checkHealth();
    setTimeout(() => setIsChecking(false), 400);
  };

  return (
    <header className="h-16 bg-background-secondary/80 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-card lg:hidden"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-base font-semibold text-text-primary tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Truthful Backend Status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-background-card px-3 py-1.5 rounded-lg border border-border text-xs">
          <span
            className={clsx(
              'w-2 h-2 rounded-full shrink-0',
              health.status === 'ok'
                ? 'bg-status-success'
                : health.status === 'degraded'
                ? 'bg-status-warning'
                : 'bg-status-error'
            )}
          />
          <span className="text-xs font-medium text-text-primary">
            {health.status === 'ok'
              ? 'Backend Connected'
              : health.status === 'degraded'
              ? 'Model Not Loaded'
              : 'Backend Offline'}
          </span>

          <button
            onClick={handleManualHealthCheck}
            disabled={isChecking}
            title="Refresh backend status"
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors ml-1"
          >
            <RefreshCw
              className={clsx('w-3.5 h-3.5', isChecking && 'animate-spin text-accent-cyan')}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
