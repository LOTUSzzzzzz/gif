import { parseGIF, decompressFrame } from "gifuct-js";
import type { Frame, ParsedFrame, ParsedGif } from "gifuct-js";
import { buildCumulative, frameIndexAt } from "./timeline";

export class GifPlayer {
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly delays: number[];
  readonly cumulativeDelays: number[];
  readonly durationMs: number;
  readonly canvas: OffscreenCanvas;

  private readonly ctx: OffscreenCanvasRenderingContext2D;
  private readonly patchCanvas: OffscreenCanvas;
  private readonly patchCtx: OffscreenCanvasRenderingContext2D;
  private readonly parsed: ParsedGif;
  private readonly imageFrames: Frame[];
  private previousSnapshot: OffscreenCanvas | null = null;
  private currentIndex = -1;

  constructor(buffer: ArrayBuffer) {
    this.parsed = parseGIF(buffer);
    this.width = this.parsed.lsd.width;
    this.height = this.parsed.lsd.height;
    this.imageFrames = this.parsed.frames.filter(
      (f): f is Frame => Boolean((f as Frame).image),
    );
    this.delays = this.imageFrames.map((f) =>
      Math.max(10, (f.gce?.delay ?? 10) * 10),
    );
    this.cumulativeDelays = buildCumulative(this.delays);
    this.durationMs = this.delays.reduce((sum, d) => sum + d, 0);
    this.frameCount = this.imageFrames.length;
    this.canvas = new OffscreenCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext("2d")!;
    this.patchCanvas = new OffscreenCanvas(1, 1);
    this.patchCtx = this.patchCanvas.getContext("2d")!;
  }

  frameIndexAt(t: number): number {
    return frameIndexAt(this.cumulativeDelays, this.durationMs, t);
  }

  ensureFrame(index: number): void {
    if (this.frameCount === 0) return;
    const target = Math.max(0, Math.min(index, this.frameCount - 1));
    if (target === this.currentIndex) return;
    if (target < this.currentIndex) this.reset();
    while (this.currentIndex < target) this.step();
  }

  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }

  private reset(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.previousSnapshot = null;
    this.currentIndex = -1;
  }

  private step(): void {
    const next = this.currentIndex + 1;
    if (next >= this.frameCount) return;

    const prev =
      this.currentIndex >= 0 ? this.imageFrames[this.currentIndex] : null;
    if (prev) {
      const disposal = prev.gce?.extras.disposal ?? 0;
      const dims = prev.image.descriptor;
      if (disposal === 2) {
        this.ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
      } else if (disposal === 3 && this.previousSnapshot) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this.previousSnapshot, 0, 0);
      }
    }

    const frame = this.imageFrames[next];
    if ((frame.gce?.extras.disposal ?? 0) === 3) {
      this.previousSnapshot = this.snapshot();
    }
    const parsed = decompressFrame(frame, this.parsed.gct, true);
    if (!parsed) throw new Error("GIF 帧解码失败");
    this.drawPatch(parsed);
    this.currentIndex = next;
  }

  private drawPatch(parsed: ParsedFrame): void {
    const { dims, patch } = parsed;
    if (dims.width <= 0 || dims.height <= 0) return;
    if (
      this.patchCanvas.width !== dims.width ||
      this.patchCanvas.height !== dims.height
    ) {
      this.patchCanvas.width = dims.width;
      this.patchCanvas.height = dims.height;
    }
    const imageData = this.patchCtx.createImageData(dims.width, dims.height);
    imageData.data.set(patch);
    this.patchCtx.putImageData(imageData, 0, 0);
    this.ctx.drawImage(this.patchCanvas, dims.left, dims.top);
  }

  private snapshot(): OffscreenCanvas {
    const snap = new OffscreenCanvas(this.width, this.height);
    const snapCtx = snap.getContext("2d")!;
    snapCtx.drawImage(this.canvas, 0, 0);
    return snap;
  }
}
