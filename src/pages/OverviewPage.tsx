import React from 'react';
import { Link } from 'react-router-dom';
import {
  ImageIcon,
  Film,
  Video,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  User,
  Users,
  Upload,
  Cpu,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDetection } from '@/context/DetectionContext';
import { clsx } from 'clsx';

export const OverviewPage: React.FC = () => {
  const { health } = useDetection();

  const isModelReady = health.status === 'ok' && health.model_loaded;

  const targetClasses = [
    {
      name: 'Helmet',
      icon: ShieldCheck,
      color: 'text-detection-helmet',
      bgColor: 'bg-detection-helmet/10 border-detection-helmet/20',
      description: 'Protective safety helmet worn by a motorcycle rider or pillion passenger.',
    },
    {
      name: 'No Helmet',
      icon: ShieldAlert,
      color: 'text-detection-no_helmet',
      bgColor: 'bg-detection-no_helmet/10 border-detection-no_helmet/20',
      description: 'Motorcycle occupant detected without protective headgear.',
    },
    {
      name: 'Number Plate',
      icon: CreditCard,
      color: 'text-detection-number_plate',
      bgColor: 'bg-detection-number_plate/10 border-detection-number_plate/20',
      description: 'Vehicle license registration plate located and extracted via EasyOCR for Indian vehicle formats.',
    },
    {
      name: 'Rider',
      icon: User,
      color: 'text-detection-rider',
      bgColor: 'bg-detection-rider/10 border-detection-rider/20',
      description: 'Primary motorcycle driver seated at the handlebars controlling the vehicle.',
    },
    {
      name: 'Pillion Passenger',
      icon: Users,
      color: 'text-detection-pillion',
      bgColor: 'bg-detection-pillion/10 border-detection-pillion/20',
      description: 'Secondary passenger seated behind the primary rider.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Upload Content',
      desc: 'Upload a road traffic image or select a video file to inspect.',
      icon: Upload,
    },
    {
      step: '2',
      title: 'AI Analysis',
      desc: 'YOLO11n evaluates the image, localizing helmets, riders, and number plates.',
      icon: Cpu,
    },
    {
      step: '3',
      title: 'Review Results',
      desc: 'Inspect bounding boxes, confidence scores, and download annotated images.',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-10 py-2">
      {/* A. Welcome Section */}
      <section className="space-y-4">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Welcome to RoadVision AI
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            An AI-powered tool that detects helmets, riders, pillion passengers, and number plates in road images and videos, extracts registration numbers via OCR, and records safety compliance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link to="/image-analysis">
            <Button size="md" variant="primary" leftIcon={<ImageIcon className="w-4 h-4" />}>
              Analyze an Image
            </Button>
          </Link>

          <Link to="/video-analysis">
            <Button size="md" variant="secondary" leftIcon={<Film className="w-4 h-4" />}>
              Analyze a Video
            </Button>
          </Link>

          <Link to="/live-analysis">
            <Button size="md" variant="outline" leftIcon={<Video className="w-4 h-4" />}>
              Open Live Video Analysis
            </Button>
          </Link>
        </div>
      </section>

      {/* E. Model Status (Compact, Truthful) */}
      <section>
        <div
          className={clsx(
            'p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs',
            isModelReady
              ? 'bg-background-card border-border'
              : 'bg-status-warning/10 border-status-warning/30 text-status-warning'
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={clsx(
                'w-2.5 h-2.5 rounded-full shrink-0',
                isModelReady ? 'bg-status-success' : 'bg-status-warning'
              )}
            />
            <div>
              <span className="font-semibold text-text-primary">
                {isModelReady
                  ? 'YOLO11n Detector Ready'
                  : 'Backend Service Notice'}
              </span>
              <p className="text-text-secondary text-[11px] mt-0.5">
                {isModelReady
                  ? 'Connected to FastAPI backend with trained weights (models/best.pt)'
                  : 'FastAPI backend is offline. Run `python -m uvicorn backend.main:app --port 8000` to enable live model inference.'}
              </p>
            </div>
          </div>

          <Link
            to="/image-analysis"
            className="text-accent-cyan hover:underline font-medium flex items-center gap-1 shrink-0"
          >
            <span>Start Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* B. About the Model */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">About the Model</h3>
        <div className="bg-background-card border border-border rounded-xl p-5">
          <p className="text-xs text-text-secondary mb-4 leading-relaxed">
            RoadVision AI uses a fine-tuned YOLO11n (Nano) convolutional neural network trained specifically to detect motorcycle road safety elements in traffic scenes with high localization speed.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Model</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">YOLO11n</div>
            </div>

            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Framework</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">Ultralytics</div>
            </div>

            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Task</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">Object Detection</div>
            </div>

            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Classes</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">5 Categories</div>
            </div>

            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Resolution</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">640 × 640 px</div>
            </div>

            <div className="p-3 rounded-lg bg-background-secondary border border-border-subtle">
              <span className="text-[11px] text-text-muted">Backend</span>
              <div className="font-medium text-xs text-text-primary mt-0.5">FastAPI REST</div>
            </div>
          </div>
        </div>
      </section>

      {/* C. What Can It Detect? */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">What Can It Detect?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {targetClasses.map((item) => (
            <div
              key={item.name}
              className="p-4 rounded-xl bg-background-card border border-border flex items-start gap-3.5"
            >
              <div className={clsx('p-2.5 rounded-lg border shrink-0', item.bgColor)}>
                <item.icon className={clsx('w-5 h-5', item.color)} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">{item.name}</h4>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* D. How It Works */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((item) => (
            <div
              key={item.step}
              className="p-5 rounded-xl bg-background-card border border-border relative space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan font-bold text-xs flex items-center justify-center">
                  {item.step}
                </span>
                <item.icon className="w-4 h-4 text-text-muted" />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
