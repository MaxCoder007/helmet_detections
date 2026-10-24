/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEFAULT_CONF?: string;
  readonly VITE_DEFAULT_IOU?: string;
  readonly VITE_DEFAULT_IMGSZ?: string;
  readonly VITE_MAX_FILE_SIZE_MB?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
