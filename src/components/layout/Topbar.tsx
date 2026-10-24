import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  RefreshCw,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { useDetection } from '@/context/DetectionContext';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { health, checkHealth, settings } = useDetection();
  const [isChecking, setIsChecking] = useState(false);

  // Derive page titles
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Overview Dashboard', category: 'Analytics' };
      case '/detect':
        return { title: 'Image Detection Workspace', category: 'Inference' };
      case '/video':
        return { title: 'Video Analysis Pipeline', category: 'Beta' };
      case '/history':
        return { title: 'Detection History', category: 'Records' };
      case '/model-info':
        return { title: 'Model Information & Architecture', category: 'Specifications' };
      case '/settings':
        return { title: 'System Settings', category: 'Configuration' };
      default:
        return { title: 'RoadVision AI', category: 'System' };
    }
  };

  const { title, category } = getPageInfo();

  const handleManualHealthCheck = async () => {
    setIsChecking(true);
    await checkHealth();
    setTimeout(() => setIsChecking(false), 500);
  };

  return (
    <header className="h-16 bg-background-secondary/80 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-card lg:hidden"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span>RoadVision</span>
            <span>/</span>
            <span className="text-text-muted">{category}</span>
          </div>
          <h1 className="text-sm font-semibold text-text-primary tracking-tight truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Live Status Indicators & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Demo Mode Badge */}
        {settings.demoMode && (
          <Badge variant="pink" size="sm" dot>
            <span className="hidden sm:inline">Demo Mode</span>
            <span className="sm:hidden">Demo</span>
          </Badge>
        )}

        {/* Real Backend Status Indicator */}
        <div className="flex items-center gap-2 bg-background-card px-2.5 py-1.5 rounded-lg border border-border text-xs">
          <span
            className={clsx(
              'w-2 h-2 rounded-full shrink-0',
              health.status === 'ok'
                ? 'bg-status-success shadow-glow-cyan'
                : health.status === 'degraded'
                ? 'bg-status-warning'
                : 'bg-status-error animate-pulse'
            )}
          />
          <div className="hidden md:flex flex-col text-[11px] leading-tight">
            <span className="font-medium text-text-primary">
              {health.status === 'ok'
                ? 'Backend Online'
                : health.status === 'degraded'
                ? 'Backend Degraded'
                : 'Backend Offline'}
            </span>
            {health.status === 'ok' && health.latency_ms !== undefined ? (
              <span className="text-[10px] text-text-muted">{health.latency_ms}ms ping</span>
            ) : (
              <span className="text-[10px] text-status-error">Port 8000</span>
            )}
          </div>

          <button
            onClick={handleManualHealthCheck}
            disabled={isChecking}
            title="Refresh backend connection status"
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isChecking && 'animate-spin text-accent-cyan')} />
          </button>
        </div>

        {/* Model Ready Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 bg-background-card px-2.5 py-1.5 rounded-lg border border-border text-xs">
          <Cpu className="w-3.5 h-3.5 text-accent-cyan shrink-0" />
          <span className="text-text-secondary text-[11px]">Model:</span>
          <span
            className={clsx(
              'font-mono font-medium text-[11px]',
              health.model_loaded ? 'text-status-success' : 'text-status-warning'
            )}
          >
            {health.model_loaded ? 'YOLO11n Ready' : settings.demoMode ? 'Simulated' : 'Not Ready'}
          </span>
        </div>

        {/* Action Button */}
        {location.pathname !== '/detect' && (
          <Link to="/detect">
            <Button size="sm" variant="primary" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">New Detection</span>
              <span className="sm:hidden">Detect</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
};
