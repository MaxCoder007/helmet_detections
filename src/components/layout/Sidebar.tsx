import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanEye,
  Video,
  History,
  Cpu,
  Settings,
  ShieldAlert,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDetection } from '@/context/DetectionContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { health, settings } = useDetection();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/detect',
      label: 'Image Detection',
      icon: ScanEye,
      badge: 'Core',
    },
    {
      to: '/video',
      label: 'Video Analysis',
      icon: Video,
      badge: 'Planned',
      badgeColor: 'text-text-muted bg-background-hover border-border',
    },
    {
      to: '/history',
      label: 'Detection History',
      icon: History,
      badge: null,
    },
    {
      to: '/model-info',
      label: 'Model Information',
      icon: Cpu,
      badge: null,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={clsx(
          'fixed top-0 bottom-0 left-0 z-50 w-64 bg-background-secondary border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shadow-glow-cyan/20">
              <ShieldAlert className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-text-primary">
                  RoadVision
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-text-secondary tracking-wide">
                Safety & Plate Detector
              </p>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-md lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Banner if active */}
        {settings.demoMode && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-accent-pink/10 border border-accent-pink/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
              <span className="text-[11px] font-semibold text-accent-pink tracking-wide">
                Demo Mode Active
              </span>
            </div>
            <NavLink
              to="/settings"
              onClick={onClose}
              className="text-[10px] text-text-secondary hover:text-text-primary underline"
            >
              Config
            </NavLink>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Navigation
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-background-card text-accent-cyan border border-accent-cyan/30 shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-card/50 border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={clsx(
                        'w-4 h-4 transition-colors',
                        isActive
                          ? 'text-accent-cyan'
                          : 'text-text-secondary group-hover:text-text-primary'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                        item.badgeColor ||
                          (isActive
                            ? 'text-accent-cyan bg-accent-cyan/15 border-accent-cyan/40'
                            : 'text-text-muted bg-background-hover border-border')
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-accent-cyan" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Model & System Status in Sidebar Footer */}
        <div className="p-4 border-t border-border bg-background-muted/40">
          <div className="p-3 rounded-lg bg-background-card border border-border text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-text-secondary text-[11px]">Detector Core</span>
              <span className="font-mono text-[10px] text-accent-cyan font-semibold">
                YOLO11n
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-[11px]">Backend API</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    health.status === 'ok'
                      ? 'bg-status-success shadow-glow-cyan'
                      : health.status === 'degraded'
                      ? 'bg-status-warning'
                      : 'bg-status-error'
                  )}
                />
                <span className="text-[11px] font-medium capitalize text-text-primary">
                  {health.status}
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[10px] text-text-muted">
              <span>5 Target Classes</span>
              <NavLink
                to="/model-info"
                onClick={onClose}
                className="text-accent-cyan hover:underline flex items-center gap-0.5"
              >
                Docs <ExternalLink className="w-2.5 h-2.5" />
              </NavLink>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
