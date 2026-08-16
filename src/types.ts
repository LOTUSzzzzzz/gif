export interface GifMeta {
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  sizeBytes: number;
}

export interface GifAsset {
  id: string;
  name: string;
  file: File;
  meta: GifMeta | null;
  previewUrl: string | null;
  rotation: number;
  speed: number;
}

export interface GridConfig {
  columns: number;
  rows: number;
  gap: number;
  backgroundColor: string;
  scale: number;
  maxDurationSec: number;
  sampleIntervalMs: number;
  ssimThreshold: number;
}

export interface CandidateSpec {
  lossy: number;
  colors: number;
}

export interface CandidateResult {
  spec: CandidateSpec;
  sizeBytes: number;
  ssim: number;
  accepted: boolean;
}

export interface ExportStats {
  outputWidth: number;
  outputHeight: number;
  frameCount: number;
  durationMs: number;
  totalSourceBytes: number;
  baselineSizeBytes: number;
  finalSizeBytes: number;
  ssim: number;
  chosen: CandidateSpec;
  candidates: CandidateResult[];
}

export type WorkerRequest =
  | {
      type: "prepare";
      assets: Array<{
        id: string;
        buffer: ArrayBuffer;
        rotation?: number;
        speed?: number;
      }>;
    }
  | { type: "reorder"; ids: string[] }
  | { type: "rotations"; rotations: Array<{ id: string; angle: number }> }
  | { type: "speeds"; speeds: Array<{ id: string; speed: number }> }
  | { type: "preview"; t: number; width: number; height: number; config: GridConfig }
  | { type: "export"; config: GridConfig }
  | { type: "cancel" };

export type WorkerResponse =
  | {
      type: "prepared";
      meta: Array<{ id: string; meta: GifMeta }>;
      thumbnails: Array<{ id: string; bitmap: ImageBitmap }>;
      estimatedMemoryBytes: number;
    }
  | { type: "preview"; bitmap: ImageBitmap }
  | { type: "progress"; phase: string; percent: number; detail?: string }
  | { type: "candidate"; result: CandidateResult; bestSizeBytes: number | null }
  | { type: "exported"; stats: ExportStats; bytes: Uint8Array }
  | { type: "cancelled" }
  | { type: "error"; message: string };
