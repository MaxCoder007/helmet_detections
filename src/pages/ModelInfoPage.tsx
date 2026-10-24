import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ClassBadge } from '@/components/detection/ClassBadge';
import { DETECTION_CLASSES } from '@/utils/constants';
import {
  Cpu,
  Layers,
  Server,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ModelInfoPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Model Specifications & Architecture
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Technical documentation for the fine-tuned YOLO11n motorcycle safety detector
          </p>
        </div>

        <Link to="/detect">
          <Button variant="primary" size="sm" leftIcon={<Zap className="w-3.5 h-3.5" />}>
            Test in Workspace
          </Button>
        </Link>
      </div>

      {/* Responsible AI & System Scope Notice */}
      <div className="p-4 rounded-xl bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <h4 className="font-semibold text-text-primary mb-0.5">
            Operational Scope & Decision Support Notice
          </h4>
          <p className="text-text-secondary">
            RoadVision AI is designed as a computer-vision assistive inspection tool for academic research, traffic flow analytics, and operator decision support. It is <strong>not</strong> an autonomous punitive traffic enforcement system. Model predictions reflect statistical confidence scores based on visual features and require human verification in legal or safety-critical decisions.
          </p>
        </div>
      </div>

      {/* Model Overview Technical Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan mb-3">
            <Cpu className="w-4 h-4" />
          </div>
          <span className="text-xs text-text-muted">Model Backbone</span>
          <h3 className="text-base font-bold text-text-primary mt-0.5">YOLO11n (Nano)</h3>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            Latest generation Ultralytics real-time object detector optimized for ultra-low latency edge and server deployments (~2.6 million parameters).
          </p>
        </Card>

        <Card>
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-xs text-text-muted">Inference Pipeline</span>
          <h3 className="text-base font-bold text-text-primary mt-0.5">Letterbox 640 × 640</h3>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            Standard 640px square letterboxing with aspect ratio preservation. Supports configurable resolutions up to 1024px for fine-grained plate localization.
          </p>
        </Card>

        <Card>
          <div className="w-8 h-8 rounded-lg bg-status-success/10 border border-status-success/30 flex items-center justify-center text-status-success mb-3">
            <Server className="w-4 h-4" />
          </div>
          <span className="text-xs text-text-muted">Inference Server</span>
          <h3 className="text-base font-bold text-text-primary mt-0.5">Python FastAPI</h3>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            Asynchronous FastAPI REST server loading <code className="text-accent-cyan">best.pt</code> with PyTorch/TorchScript, executing non-maximum suppression (NMS) on GPU/CPU.
          </p>
        </Card>
      </div>

      {/* Target Classes Reference Table */}
      <Card>
        <CardHeader
          title="Target Classes (nc = 5)"
          subtitle="Definitions, safety criteria, and canonical IDs recognized by the model"
        />

        <div className="divide-y divide-border">
          {Object.entries(DETECTION_CLASSES).map(([key, config], idx) => (
            <div key={key} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-md bg-background-secondary border border-border flex items-center justify-center font-mono text-xs text-text-muted">
                  {idx}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-text-primary">
                      {config.displayName}
                    </span>
                    <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-background-secondary border border-border text-text-secondary">
                      {config.name}
                    </code>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 max-w-xl">
                    {config.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <ClassBadge detectionClass={config.name} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Dataset & Training Methodology (Verified Project Data) */}
      <Card>
        <CardHeader
          title="Training & Dataset Specifications"
          subtitle="Verified parameters from the project's training runs"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-background-secondary border border-border">
            <span className="text-text-muted">Training Datasets</span>
            <div className="font-medium text-text-primary mt-1">
              Helmet-&-Number-Plate-Detection-2-1 & Bike-Number-Plate-1
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background-secondary border border-border">
            <span className="text-text-muted">Training Strategy</span>
            <div className="font-medium text-text-primary mt-1">
              50 Epochs, close_mosaic=20, mosaic=1.0, seed=0
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background-secondary border border-border">
            <span className="text-text-muted">Model Checkpoint Location</span>
            <div className="font-mono text-accent-cyan mt-1">
              models/best.pt (5.44 MB)
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
