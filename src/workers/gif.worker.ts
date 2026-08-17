import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { GifPlayer } from "../lib/gifPlayer";
import { runGifsicle } from "../lib/gifsicle";
import { repairTransparentGif } from "../lib/gifRepair";
import { CANDIDATES } from "../lib/candidates";
import { computeExportTimeline, sampleIndexes } from "../lib/timeline";
import {
  effectiveSampleIntervalMs,
  effectiveSsimThreshold,
  gridCellCount,
  MAX_EXPORT_SIDE,
} from "../lib/exportPolicy";
import {
  computeGridGeometry,
  computeOutputSize,
  containRect,
} from "../lib/layout";
import type { CellSize } from "../lib/layout";
import { averageSsim, toLuma } from "../lib/ssim";
import type {
  CandidateResult,
  CandidateSpec,
  ExportStats,
  GifMeta,
  GridConfig,
  WorkerRequest,
  WorkerResponse,
} from "../types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface PreparedAsset {
  id: string;
  player: GifPlayer;
  sizeBytes: number;
  rotation: number;
  speed: number;
}

interface RefLuma {
  timeMs: number;
  luma: Uint8Array;
}

let assets: PreparedAsset[] = [];
let cancelled = false;

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  if (transfer) ctx.postMessage(message, transfer);
  else ctx.postMessage(message);
}

function drawGrid(
  target: OffscreenCanvasRenderingContext2D,
  t: number,
  config: GridConfig,
  width: number,
  height: number,
): void {
  if (assets.length === 0) return;
  target.clearRect(0, 0, width, height);
  if (config.backgroundColor && config.backgroundColor !== "transparent") {
    target.fillStyle = config.backgroundColor;
    target.fillRect(0, 0, width, height);
  }
  const geometry = computeGridGeometry(
    assets.length,
    config,
    width,
    height,
    gridCellSize(),
  );
  const totalCells = geometry.rows * geometry.columns;
  const cellCount =
    geometry.rows === 1 && geometry.columns === 1 && assets.length > 1
      ? 1
      : totalCells;
  for (let i = 0; i < cellCount; i++) {
    if (cancelled) return;
    const asset = assets[i % assets.length];
    const player = asset.player;
    const column = i % geometry.columns;
    const row = Math.floor(i / geometry.columns);
    player.ensureFrame(player.frameIndexAt(t * (asset.speed || 1)));
    const rect = containRect(
      player.width,
      player.height,
      geometry.cellWidth,
      geometry.cellHeight,
    );
    const cellX = geometry.offsetX + column * (geometry.cellWidth + config.gap);
    const cellY = geometry.offsetY + row * (geometry.cellHeight + config.gap);
    const angleRad = ((asset.rotation || 0) * Math.PI) / 180;
    const centerX = cellX + geometry.cellWidth / 2;
    const centerY = cellY + geometry.cellHeight / 2;
    target.save();
    target.translate(centerX, centerY);
    target.rotate(angleRad);
    target.drawImage(
      player.canvas,
      rect.x - geometry.cellWidth / 2,
      rect.y - geometry.cellHeight / 2,
      rect.width,
      rect.height,
    );
    target.restore();
  }
}

function gridCellSize(): CellSize {
  let width = 1;
  let height = 1;
  for (const asset of assets) {
    width = Math.max(width, asset.player.width);
    height = Math.max(height, asset.player.height);
  }
  return { width, height };
}

function makeThumbnail(player: GifPlayer, maxSide: number): ImageBitmap {
  const scale = Math.min(1, maxSide / Math.max(player.width, player.height));
  const thumb = new OffscreenCanvas(
    Math.max(1, Math.round(player.width * scale)),
    Math.max(1, Math.round(player.height * scale)),
  );
  const thumbCtx = thumb.getContext("2d")!;
  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = "high";
  thumbCtx.drawImage(player.canvas, 0, 0, thumb.width, thumb.height);
  return thumb.transferToImageBitmap();
}

function downscaleLuma(imageData: ImageData, maxSide: number): Uint8Array {
  const scale = Math.min(1, maxSide / Math.max(imageData.width, imageData.height));
  const tw = Math.max(1, Math.round(imageData.width * scale));
  const th = Math.max(1, Math.round(imageData.height * scale));
  const source = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceCtx = source.getContext("2d")!;
  sourceCtx.putImageData(imageData, 0, 0);
  const target = new OffscreenCanvas(tw, th);
  const targetCtx = target.getContext("2d")!;
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";
  targetCtx.drawImage(source, 0, 0, tw, th);
  return toLuma(targetCtx.getImageData(0, 0, tw, th).data);
}

function measureSsim(
  output: Uint8Array,
  sampleTimes: number[],
  refs: RefLuma[],
): number {
  const buffer = output.buffer.slice(
    output.byteOffset,
    output.byteOffset + output.byteLength,
  ) as ArrayBuffer;
  const player = new GifPlayer(buffer);
  const lumas: Uint8Array[] = [];
  for (const t of sampleTimes) {
    player.ensureFrame(player.frameIndexAt(t));
    lumas.push(downscaleLuma(player.getImageData(), 512));
  }
  return averageSsim(
    refs.map((r) => r.luma),
    lumas,
  );
}

function prepare(
  payloads: Array<{
    id: string;
    buffer: ArrayBuffer;
    rotation?: number;
    speed?: number;
  }>,
): void {
  try {
    const next: PreparedAsset[] = [];
    const thumbnails: Array<{ id: string; bitmap: ImageBitmap }> = [];
    const metas: Array<{ id: string; meta: GifMeta }> = [];
    let estimatedMemoryBytes = 0;
    for (const payload of payloads) {
      const player = new GifPlayer(payload.buffer);
      player.ensureFrame(0);
      const meta: GifMeta = {
        width: player.width,
        height: player.height,
        frameCount: player.frameCount,
        durationMs: player.durationMs,
        sizeBytes: payload.buffer.byteLength,
      };
      estimatedMemoryBytes += player.frameCount * player.width * player.height * 4;
      next.push({
        id: payload.id,
        player,
        sizeBytes: payload.buffer.byteLength,
        rotation: payload.rotation ?? 0,
        speed: payload.speed ?? 1,
      });
      metas.push({ id: payload.id, meta });
      thumbnails.push({ id: payload.id, bitmap: makeThumbnail(player, 160) });
    }
    assets = next;
    post(
      {
        type: "prepared",
        meta: metas,
        thumbnails,
        estimatedMemoryBytes,
      },
      thumbnails.map((t) => t.bitmap),
    );
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function preview(
  t: number,
  width: number,
  height: number,
  config: GridConfig,
): void {
  if (assets.length === 0) return;
  const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  const target = canvas.getContext("2d")!;
  drawGrid(target, t, config, canvas.width, canvas.height);
  const bitmap = canvas.transferToImageBitmap();
  post({ type: "preview", bitmap }, [bitmap]);
}

async function exportGif(config: GridConfig): Promise<void> {
  if (assets.length === 0) return;
  cancelled = false;
  try {
    const cellCount = gridCellCount(
      assets.length,
      config.columns,
      config.rows,
    );
    const intervalMs = effectiveSampleIntervalMs(
      config.sampleIntervalMs,
      cellCount,
    );
    const durations = assets.map((a) => a.player.durationMs / (a.speed || 1));
    const longestDurationMs = Math.max(intervalMs, ...durations);
    const timeline = computeExportTimeline(
      durations,
      longestDurationMs,
      intervalMs,
    );
    const computedSize = computeOutputSize(
      assets.length,
      config,
      gridCellSize(),
    );
    const outputWidth = Math.min(
      MAX_EXPORT_SIDE,
      Math.max(
        1,
        config.outputWidth && config.outputWidth > 0
          ? config.outputWidth
          : computedSize.width,
      ),
    );
    const outputHeight = Math.min(
      MAX_EXPORT_SIDE,
      Math.max(
        1,
        config.outputHeight && config.outputHeight > 0
          ? config.outputHeight
          : computedSize.height,
      ),
    );
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const target = canvas.getContext("2d")!;
    const encoder = GIFEncoder();
    const compactEncoder =
      config.backgroundColor === "transparent" ? GIFEncoder() : null;
    const sampleTimes = sampleIndexes(timeline.frameCount, 10).map(
      (i) => i * timeline.intervalMs,
    );
    const sampleSet = new Set(
      sampleTimes.map((t) => Math.round(t / timeline.intervalMs)),
    );
    const refs: RefLuma[] = [];
    const progressEvery = Math.max(1, Math.floor(timeline.frameCount / 20));

    for (let i = 0; i < timeline.frameCount; i++) {
      if (cancelled) {
        post({ type: "cancelled" });
        return;
      }
      const t = i * timeline.intervalMs;
      drawGrid(target, t, config, outputWidth, outputHeight);
      if (cancelled) {
        post({ type: "cancelled" });
        return;
      }
      const imageData = target.getImageData(0, 0, outputWidth, outputHeight);
      if (sampleSet.has(i)) {
        refs.push({ timeMs: t, luma: downscaleLuma(imageData, 512) });
      }
      const useTransparency = config.backgroundColor === "transparent";
      const palette = quantize(
        imageData.data,
        256,
        useTransparency ? { format: "rgba4444", oneBitAlpha: true } : undefined,
      );
      const index = applyPalette(
        imageData.data,
        palette,
        useTransparency ? "rgba4444" : undefined,
      );
      let framePalette = palette;
      let frameIndex = index;
      let transparentIndex = useTransparency
        ? palette.findIndex((c) => (c[3] ?? 255) < 128)
        : -1;
      if (useTransparency && transparentIndex > 0) {
        const swapped = palette.slice();
        const transparentColor = swapped[0];
        swapped[0] = swapped[transparentIndex];
        swapped[transparentIndex] = transparentColor;
        const remapped = new Uint8Array(index.length);
        for (let p = 0; p < index.length; p++) {
          if ((p & 0xffff) === 0 && cancelled) {
            post({ type: "cancelled" });
            return;
          }
          const v = index[p];
          remapped[p] =
            v === 0 ? transparentIndex : v === transparentIndex ? 0 : v;
        }
        framePalette = swapped;
        frameIndex = remapped;
        transparentIndex = 0;
      }
      encoder.writeFrame(frameIndex, outputWidth, outputHeight, {
        palette: framePalette,
        delay: timeline.intervalMs,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
      });
      if (compactEncoder) {
        if (cancelled) {
          post({ type: "cancelled" });
          return;
        }
        const compactPalette = quantize(imageData.data, 128, {
          format: "rgba4444",
          oneBitAlpha: true,
        });
        const compactIndex = applyPalette(
          imageData.data,
          compactPalette,
          "rgba4444",
        );
        let compactFramePalette = compactPalette;
        let compactFrameIndex = compactIndex;
        let compactTransparentIndex = compactPalette.findIndex(
          (c) => (c[3] ?? 255) < 128,
        );
        if (compactTransparentIndex > 0) {
          const swapped = compactPalette.slice();
          const transparentColor = swapped[0];
          swapped[0] = swapped[compactTransparentIndex];
          swapped[compactTransparentIndex] = transparentColor;
          const remapped = new Uint8Array(compactIndex.length);
          for (let p = 0; p < compactIndex.length; p++) {
            if ((p & 0xffff) === 0 && cancelled) {
              post({ type: "cancelled" });
              return;
            }
            const v = compactIndex[p];
            remapped[p] =
              v === 0
                ? compactTransparentIndex
                : v === compactTransparentIndex
                  ? 0
                  : v;
          }
          compactFramePalette = swapped;
          compactFrameIndex = remapped;
          compactTransparentIndex = 0;
        }
        compactEncoder.writeFrame(
          compactFrameIndex,
          outputWidth,
          outputHeight,
          {
            palette: compactFramePalette,
            delay: timeline.intervalMs,
            transparent: compactTransparentIndex >= 0,
            transparentIndex:
              compactTransparentIndex >= 0 ? compactTransparentIndex : undefined,
          },
        );
      }
      if (i % progressEvery === 0 || i === timeline.frameCount - 1) {
        post({
          type: "progress",
          phase: "合成",
          percent: Math.round(((i + 1) / timeline.frameCount) * 45),
        });
      }
    }

    post({ type: "progress", phase: "编码", percent: 50 });
    encoder.finish();
    const rawBytes = encoder.bytes();
    let compactBytes: Uint8Array | null = null;
    if (compactEncoder) {
      compactEncoder.finish();
      compactBytes = compactEncoder.bytes();
    }
    post({ type: "progress", phase: "压缩", percent: 55 });

    const results: CandidateResult[] = [];
    const threshold = effectiveSsimThreshold(config.ssimThreshold, cellCount);
    const outputs = new Map<string, Uint8Array>();
    let acceptedAny = false;
    let bestBytes = rawBytes;
    let bestSpec: CandidateSpec = { lossy: 0, colors: 256 };
    let bestSize = rawBytes.length;

    if (compactBytes) {
      results.push(
        {
          spec: { lossy: 0, colors: 256 },
          sizeBytes: rawBytes.length,
          ssim: 1,
          accepted: true,
        },
        {
          spec: { lossy: 0, colors: 128 },
          sizeBytes: compactBytes.length,
          ssim: 1,
          accepted: true,
        },
      );
      bestBytes = compactBytes;
      bestSize = compactBytes.length;
      bestSpec = { lossy: 0, colors: 128 };
      post({
        type: "candidate",
        result: results[0],
        bestSizeBytes: null,
      });
      post({
        type: "candidate",
        result: results[1],
        bestSizeBytes: compactBytes.length,
      });
    } else {
      results.push({
        spec: { lossy: 0, colors: 256 },
        sizeBytes: rawBytes.length,
        ssim: 1,
        accepted: true,
      });
      bestBytes = rawBytes;
      bestSize = rawBytes.length;
      bestSpec = { lossy: 0, colors: 256 };
    }

    const optimizeArgs =
      config.backgroundColor === "transparent"
        ? ["-O3", "--disposal=2"]
        : ["-O2"];

    const candidates = CANDIDATES;
    for (let ci = 0; ci < candidates.length; ci++) {
      if (cancelled) {
        post({ type: "cancelled" });
        return;
      }
      const spec = candidates[ci];
      post({
        type: "progress",
        phase: "压缩",
        percent: 55 + Math.round((ci / candidates.length) * 45),
        detail: `lossy ${spec.lossy} / ${spec.colors} 色`,
      });
      try {
        const gifsicleOutput = await runGifsicle(rawBytes, [
          ...optimizeArgs,
          `--lossy=${spec.lossy}`,
          `--colors=${spec.colors}`,
        ]);
        const output =
          config.backgroundColor === "transparent"
            ? repairTransparentGif(gifsicleOutput)
            : gifsicleOutput;
        outputs.set(`${spec.lossy}-${spec.colors}`, output);
        const ssim = measureSsim(output, sampleTimes, refs);
        const result: CandidateResult = {
          spec,
          sizeBytes: output.length,
          ssim,
          accepted: ssim >= threshold,
        };
        results.push(result);
        if (result.accepted) acceptedAny = true;
        if (result.accepted && output.length < bestSize) {
          bestSize = output.length;
          bestBytes = output;
          bestSpec = spec;
        }
        post({
          type: "candidate",
          result,
          bestSizeBytes: bestSize < rawBytes.length ? bestSize : null,
        });
      } catch {
        // 某个候选失败时跳过，继续尝试其他档位
      }
    }

    if (!acceptedAny && results.length > 0) {
      const smallest = results.reduce((a, b) =>
        a.sizeBytes < b.sizeBytes ? a : b,
      );
      const key = `${smallest.spec.lossy}-${smallest.spec.colors}`;
      const smallestBytes = outputs.get(key);
      if (smallestBytes && smallestBytes.length < bestSize) {
        bestBytes = smallestBytes;
        bestSize = smallestBytes.length;
        bestSpec = smallest.spec;
      }
    }

    if (results.length === 0) {
      results.push({
        spec: bestSpec,
        sizeBytes: rawBytes.length,
        ssim: 1,
        accepted: true,
      });
    }

    const stats: ExportStats = {
      outputWidth,
      outputHeight,
      frameCount: timeline.frameCount,
      durationMs: timeline.durationMs,
      totalSourceBytes: assets.reduce((sum, a) => sum + a.sizeBytes, 0),
      baselineSizeBytes: rawBytes.length,
      finalSizeBytes: bestBytes.length,
      ssim: config.ssimThreshold,
      chosen: bestSpec,
      candidates: results,
    };
    post({ type: "exported", stats, bytes: bestBytes }, [bestBytes.buffer]);
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case "prepare":
      prepare(request.assets);
      break;
    case "reorder": {
      const order = new Map(request.ids.map((id, index) => [id, index]));
      assets = assets
        .slice()
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      break;
    }
    case "rotations": {
      const angleById = new Map(request.rotations.map((r) => [r.id, r.angle]));
      for (const asset of assets) {
        if (angleById.has(asset.id)) {
          asset.rotation = angleById.get(asset.id) ?? 0;
        }
      }
      break;
    }
    case "speeds": {
      const speedById = new Map(request.speeds.map((r) => [r.id, r.speed]));
      for (const asset of assets) {
        if (speedById.has(asset.id)) {
          asset.speed = Math.max(1, Math.min(5, speedById.get(asset.id) ?? 1));
        }
      }
      break;
    }
    case "preview":
      preview(request.t, request.width, request.height, request.config);
      break;
    case "export":
      void exportGif(request.config);
      break;
    case "cancel":
      cancelled = true;
      break;
  }
};
