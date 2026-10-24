import { DetectionClass, ClassConfig, AppSettings } from '@/types/detection';

export const DETECTION_CLASSES: Record<DetectionClass, ClassConfig> = {
  helmet: {
    name: 'helmet',
    displayName: 'Helmet',
    color: '#34D399', // Emerald Green
    bgRgba: 'rgba(52, 211, 153, 0.15)',
    borderClass: 'border-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Protective safety helmet securely worn by the motorcycle rider or pillion passenger (Safety Compliant).',
  },
  no_helmet: {
    name: 'no_helmet',
    displayName: 'No Helmet',
    color: '#F87171', // Coral Red
    bgRgba: 'rgba(248, 113, 113, 0.18)',
    borderClass: 'border-red-500',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
    description: 'Motorcycle occupant detected without protective headgear (Critical Traffic Violation).',
  },
  number_plate: {
    name: 'number_plate',
    displayName: 'Number Plate',
    color: '#8BE8FF', // Cyan
    bgRgba: 'rgba(139, 232, 255, 0.15)',
    borderClass: 'border-accent-cyan',
    badgeClass: 'bg-cyan-500/10 text-accent-cyan border-cyan-500/30',
    description: 'Vehicle license registration plate located for legal identification and tracking.',
  },
  pillion: {
    name: 'pillion',
    displayName: 'Pillion Rider',
    color: '#FBBF24', // Amber
    bgRgba: 'rgba(251, 191, 36, 0.15)',
    borderClass: 'border-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Secondary passenger seated on the pillion seat behind the main rider.',
  },
  rider: {
    name: 'rider',
    displayName: 'Rider',
    color: '#A78BFA', // Purple
    bgRgba: 'rgba(167, 139, 250, 0.15)',
    borderClass: 'border-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    description: 'Primary motorcycle operator seated at the handlebars controlling the vehicle.',
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  confidenceThreshold: Number(import.meta.env.VITE_DEFAULT_CONF) || 0.25,
  iouThreshold: Number(import.meta.env.VITE_DEFAULT_IOU) || 0.45,
  imageSize: Number(import.meta.env.VITE_DEFAULT_IMGSZ) || 640,
  maxFileSizeMb: Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 15,
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  showLabels: true,
  showConfidence: true,
  boxThickness: 2,
  boxOpacity: 0.85,
};

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const MODEL_METADATA = {
  name: 'YOLO11n (Motorcycle Safety Detection)',
  architecture: 'YOLO11 Nano by Ultralytics',
  framework: 'PyTorch / Ultralytics 8.x',
  task: 'Object Detection (Bounding Box)',
  parameters: '~2.6 Million Parameters',
  inputResolution: '640 x 640 px (letterbox padded)',
  numberOfClasses: 5,
  classes: ['helmet', 'no_helmet', 'number_plate', 'pillion', 'rider'],
  backendFramework: 'FastAPI (Python 3.11)',
  inferenceEngine: 'PyTorch CPU / CUDA',
  datasetInfo: 'Custom road & motorcycle traffic dataset curated for helmet compliance and license plate localization.',
};
