import React from 'react';
import { useDetection } from '@/context/DetectionContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { ClassBreakdownChart } from '@/components/dashboard/ClassBreakdownChart';
import { RecentAnalysisList } from '@/components/dashboard/RecentAnalysisList';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import {
  ScanEye,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { calculateComplianceRate } from '@/utils/formatters';

export const OverviewPage: React.FC = () => {
  const { history, health, settings } = useDetection();

  // Aggregate session metrics
  const sessionImagesAnalyzed = history.length;
  const sessionTotalObjects = history.reduce(
    (sum, item) => sum + item.result.detections.length,
    0
  );

  const sessionCounts = history.reduce(
    (acc, item) => {
      acc.helmet += item.result.counts.helmet || 0;
      acc.no_helmet += item.result.counts.no_helmet || 0;
      acc.number_plate += item.result.counts.number_plate || 0;
      acc.rider += item.result.counts.rider || 0;
      acc.pillion += item.result.counts.pillion || 0;
      return acc;
    },
    { helmet: 0, no_helmet: 0, number_plate: 0, rider: 0, pillion: 0 }
  );

  const complianceRate = calculateComplianceRate(sessionCounts);

  const averageInferenceTime =
    sessionImagesAnalyzed > 0
      ? Math.round(
          history.reduce((sum, item) => sum + item.result.inference_time_ms, 0) /
            sessionImagesAnalyzed
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-background-card via-background-card to-background-secondary border border-border p-6 sm:p-8 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-accent-cyan/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Motorcycle Safety Intelligence</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            RoadVision AI Dashboard
          </h2>

          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Real-time computer vision system using YOLO11n to detect helmet compliance, safety violations, license plates, and motorcycle occupants from road and traffic imagery.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link to="/detect">
              <Button size="lg" variant="primary" leftIcon={<ScanEye className="w-4 h-4" />}>
                Launch Image Detection
              </Button>
            </Link>

            <Link to="/model-info">
              <Button size="lg" variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View Model Specs
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Session Notice Note */}
      <div className="p-3.5 rounded-xl bg-background-card/60 border border-border flex items-start gap-3 text-xs text-text-secondary">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Session-Based Statistics: </span>
          The figures below reflect real inference results processed during your current browser session. Upload photos in the workspace to evaluate the detector.
        </div>
      </div>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Images Analyzed (Session)"
          value={sessionImagesAnalyzed}
          subtitle={sessionImagesAnalyzed === 1 ? '1 image processed' : `${sessionImagesAnalyzed} images processed`}
          icon={<ScanEye className="w-5 h-5 text-accent-cyan" />}
          glowColor="cyan"
        />

        <StatCard
          title="Total Detections"
          value={sessionTotalObjects}
          subtitle={`Avg ${averageInferenceTime}ms latency`}
          icon={<Layers className="w-5 h-5 text-purple-400" />}
          glowColor="pink"
        />

        <StatCard
          title="Helmet Compliance Rate"
          value={complianceRate !== null ? `${complianceRate}%` : 'N/A'}
          subtitle={
            complianceRate !== null
              ? `${sessionCounts.helmet} compliant / ${sessionCounts.no_helmet} violations`
              : 'No helmet data yet'
          }
          icon={<ShieldCheck className="w-5 h-5 text-status-success" />}
          glowColor="emerald"
        />

        <StatCard
          title="Number Plates Identified"
          value={sessionCounts.number_plate}
          subtitle={`${sessionCounts.rider} riders, ${sessionCounts.pillion} pillions`}
          icon={<CreditCard className="w-5 h-5 text-accent-cyan" />}
          glowColor="cyan"
        />
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Breakdown Chart (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Session Detection Distribution"
            subtitle="Counts per class across all analyzed images in this session"
            action={
              <span className="text-xs font-mono text-accent-cyan">
                {sessionTotalObjects} total
              </span>
            }
          />
          <ClassBreakdownChart counts={sessionCounts} totalObjects={sessionTotalObjects} />
        </Card>

        {/* Model & System Specs Card */}
        <Card>
          <CardHeader
            title="Detector Status"
            subtitle="Configured YOLO11n weights"
          />

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <span className="text-text-secondary">Model Checkpoint</span>
              <span className="font-mono font-semibold text-text-primary">
                models/best.pt
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <span className="text-text-secondary">Architecture</span>
              <span className="font-semibold text-accent-cyan">
                YOLO11n (Ultralytics)
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <span className="text-text-secondary">Input Resolution</span>
              <span className="font-mono text-text-primary">
                {settings.imageSize} × {settings.imageSize} px
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <span className="text-text-secondary">Confidence Threshold</span>
              <span className="font-mono text-text-primary">
                {Math.round(settings.confidenceThreshold * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <span className="text-text-secondary">Backend API Health</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.status === 'ok'
                      ? 'bg-status-success'
                      : health.status === 'degraded'
                      ? 'bg-status-warning'
                      : 'bg-status-error'
                  }`}
                />
                <span className="capitalize font-semibold text-text-primary">
                  {health.status}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link to="/settings" className="w-full block">
                <Button variant="outline" size="sm" className="w-full">
                  Configure Settings
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Analyses in Current Session */}
      <Card>
        <CardHeader
          title="Recent Analyses"
          subtitle="Images analyzed during current session (Click to reopen in workspace)"
          action={
            sessionImagesAnalyzed > 0 && (
              <Link to="/history" className="text-xs text-accent-cyan hover:underline">
                View all ({sessionImagesAnalyzed})
              </Link>
            )
          }
        />
        <RecentAnalysisList records={history} />
      </Card>
    </div>
  );
};
