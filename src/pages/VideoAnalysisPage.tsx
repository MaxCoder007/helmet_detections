import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Video,
  UploadCloud,
  Film,
  Sparkles,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const VideoAnalysisPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Video Stream & File Analysis
            </h2>
            <Badge variant="warning" size="sm">
              Planned Feature
            </Badge>
          </div>
          <p className="text-xs text-text-secondary">
            Continuous motorcycle safety monitoring, frame-by-frame YOLO11n inference, and multi-object tracking
          </p>
        </div>

        <Link to="/detect">
          <Button variant="outline" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
            Use Image Detection (Live)
          </Button>
        </Link>
      </div>

      {/* Feature Notice Banner */}
      <div className="rounded-xl p-5 bg-background-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-warning/10 border border-status-warning/30 flex items-center justify-center shrink-0 text-status-warning">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              Video Inference Pipeline is Under Active Development
            </h4>
            <p className="text-xs text-text-secondary mt-1 max-w-xl leading-relaxed">
              To guarantee honest engineering and accurate system demonstration, video processing is not simulated with fake progress bars. The architecture below outlines the upcoming video pipeline integrating Ultralytics YOLO11n with ByteTrack tracking.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-background-secondary border border-border text-text-secondary shrink-0">
          Target: v1.1.0
        </span>
      </div>

      {/* Video Upload Dropzone Mockup */}
      <Card>
        <CardHeader
          title="Video Ingestion Queue"
          subtitle="Supports traffic surveillance footage and motorcycle dashcams"
        />

        <div className="border-2 border-dashed border-border/80 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-background-muted/30 opacity-75">
          <div className="w-14 h-14 rounded-2xl bg-background-hover border border-border flex items-center justify-center mb-3 text-text-muted">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h4 className="text-sm font-semibold text-text-primary mb-1">
            Video Processing Pipeline (Disabled in Preview)
          </h4>
          <p className="text-xs text-text-secondary max-w-md mb-4">
            Upcoming support for MP4, AVI, MOV, and MKV traffic recordings (up to 100MB per clip).
          </p>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled>
              Select Video File
            </Button>
            <span className="text-xs text-text-muted">or drag and drop here</span>
          </div>
        </div>
      </Card>

      {/* Video Pipeline Architecture Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan mb-3">
            <Film className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            1. Frame Extraction & Queue
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            OpenCV video stream decoding with configurable frame skipping (e.g. sample every 2nd or 3rd frame) to maintain real-time 30+ FPS throughput.
          </p>
        </Card>

        <Card>
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
            <Cpu className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            2. Batch YOLO11n Inference
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Ultralytics batched tensor inference combined with ByteTrack / BoT-SORT multi-object tracker to maintain unique rider and motorcycle track IDs across frames.
          </p>
        </Card>

        <Card>
          <div className="w-8 h-8 rounded-lg bg-status-success/10 border border-status-success/30 flex items-center justify-center text-status-success mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            3. Violation Aggregation
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Temporal smoothing of helmet compliance predictions, number plate persistence, and generation of downloadable annotated video with H.264 compression.
          </p>
        </Card>
      </div>
    </div>
  );
};
