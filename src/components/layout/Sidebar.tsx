import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  ImageIcon,
  Film,
  Video,
  History,
  ShieldAlert,
  Shield,
  Settings,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDetection } from '@/context/DetectionContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { health } = useDetection();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: Compass,
    },
    {
      to: '/image-analysis',
      label: 'Image Analysis',
      icon: ImageIcon,
    },
    {
      to: '/video-analysis',
      label: 'Video Analysis',
      icon: Film,
    },
    {
      to: '/live-analysis',
      label: 'Live Video Analysis',
      icon: Video,
    },
    {
      to: '/history',
      label: 'History',
      icon: History,
    },
    {
      to: '/violations',
      label: 'Violation Register',
      icon: ShieldAlert,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed top-0 bottom-0 left-0 z-50 w-60 bg-background-secondary border-r border-border flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo and Brand Name */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan">
              <Shield className="w-4 h-4 text-accent-cyan" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-text-primary">
                RoadVision AI
              </span>
            </div>
          </NavLink>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-md lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-background-card text-accent-cyan border border-accent-cyan/30 font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-card/50'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Compact, Truthful Status in Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-background-card/60 border border-border-subtle">
            <span className="text-text-secondary text-[11px]">System Status</span>
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  health.status === 'ok'
                    ? 'bg-status-success'
                    : health.status === 'degraded'
                    ? 'bg-status-warning'
                    : 'bg-status-error'
                )}
              />
              <span className="text-[11px] font-medium text-text-primary capitalize">
                {health.status === 'ok' ? 'Ready' : health.status === 'degraded' ? 'Degraded' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
