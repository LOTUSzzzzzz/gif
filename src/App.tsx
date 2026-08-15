import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { GripHorizontal, Sparkles } from "lucide-react";
import type {
  ExportStats,
  GifAsset,
  GridConfig,
  WorkerResponse,
} from "./types";
import { UploadZone } from "./components/UploadZone";
import { AssetList } from "./components/AssetList";
import { SettingsPanel } from "./components/SettingsPanel";
import { PreviewStage } from "./components/PreviewStage";
import { ExportPanel } from "./components/ExportPanel";
import { computeExportTimeline } from "./lib/timeline";
import { computeOutputSize } from "./lib/layout";
import { formatBytes, formatMs } from "./lib/format";

const DEFAULT_CONFIG: GridConfig = {
  columns: 1,
  rows: 1,
  gap: 0,
  backgroundColor: "#ffffff",
  scale: 1,
  maxDurationSec: 5,
  sampleIntervalMs: 20,
  ssimThreshold: 0.99,
};

const MEMORY_WARN = 300 * 1024 * 1024;
const MEMORY_BLOCK = 900 * 1024 * 1024;
const MAX_OUTPUT_SIDE = 4096;

function bitmapToDataUrl(bitmap: ImageBitmap): string {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const target = canvas.getContext("2d")!;
  target.drawImage(bitmap, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function App() {
  const [assets, setAssets] = useState<GifAsset[]>([]);
  const assetsRef = useRef<GifAsset[]>([]);
  const [config, setConfig] = useState<GridConfig>(DEFAULT_CONFIG);
  const configRef = useRef(config);
  configRef.current = config;
  const [preparing, setPreparing] = useState(false);
  const [estimatedMemory, setEstimatedMemory] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const playTimeRef = useRef(0);
  const [previewSize, setPreviewSize] = useState({ width: 800, height: 600 });
  const previewSizeRef = useRef(previewSize);
  previewSizeRef.current = previewSize;
  const [exporting, setExporting] = useState(false);
  const [exportHeight, setExportHeight] = useState(120);
  const [progress, setProgress] = useState({
    percent: 0,
    phase: "",
    detail: null as string | null,
  });
  const [result, setResult] = useState<ExportStats | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageColRef = useRef<HTMLElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const previewPendingRef = useRef(false);
  const handlerRef = useRef<(e: MessageEvent<WorkerResponse>) => void>(
    () => {},
  );

  const updateAssets = useCallback((next: GifAsset[]) => {
    assetsRef.current = next;
    setAssets(next);
  }, []);

  const sendPrepare = useCallback(async (list: GifAsset[]) => {
    const worker = workerRef.current;
    if (!worker) return;
    setPreparing(true);
    const buffers = await Promise.all(list.map((a) => a.file.arrayBuffer()));
    const payloads = list.map((a, i) => ({ id: a.id, buffer: buffers[i] }));
    worker.postMessage(
      { type: "prepare", assets: payloads },
      payloads.map((p) => p.buffer),
    );
  }, []);

  const applyPrepared = useCallback(
    async (msg: Extract<WorkerResponse, { type: "prepared" }>) => {
      const metaById = new Map(msg.meta.map((m) => [m.id, m.meta]));
      setAssets((prev) =>
        prev.map((a) =>
          metaById.has(a.id) ? { ...a, meta: metaById.get(a.id)! } : a,
        ),
      );
      setEstimatedMemory(msg.estimatedMemoryBytes);
      setSelectedAssetId((prev) => prev ?? (msg.meta[0]?.id ?? null));
      const urlById = new Map(
        msg.thumbnails.map((t) => [t.id, bitmapToDataUrl(t.bitmap)]),
      );
      setAssets((prev) =>
        prev.map((a) =>
          urlById.has(a.id)
            ? { ...a, previewUrl: urlById.get(a.id)! }
            : a,
        ),
      );
      setPreparing(false);
    },
    [],
  );

  const requestPreview = useCallback((t: number) => {
    const worker = workerRef.current;
    if (!worker || assetsRef.current.length === 0 || previewPendingRef.current) {
      return;
    }
    const size = previewSizeRef.current;
    previewPendingRef.current = true;
    worker.postMessage({
      type: "preview",
      t,
      width: size.width,
      height: size.height,
      config: configRef.current,
    });
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const gifs = files.filter(
        (f) => /\.gif$/i.test(f.name) || f.type === "image/gif",
      );
      if (gifs.length === 0) return;
      const next = [
        ...assetsRef.current,
        ...gifs.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          file,
          meta: null,
          previewUrl: null,
          rotation: 0,
        })),
      ];
      updateAssets(next);
      setSelectedAssetId((prev) => prev ?? next[0]?.id ?? null);
      await sendPrepare(next);
    },
    [sendPrepare, updateAssets],
  );

  const removeAsset = useCallback(
    (id: string) => {
      const next = assetsRef.current.filter((a) => a.id !== id);
      setSelectedAssetId((prev) =>
        prev === id ? (next[0]?.id ?? null) : prev,
      );
      updateAssets(next);
      void sendPrepare(next);
    },
    [sendPrepare, updateAssets],
  );

  const clearAssets = useCallback(() => {
    updateAssets([]);
    setSelectedAssetId(null);
    setEstimatedMemory(0);
    setResult(null);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void sendPrepare([]);
  }, [sendPrepare, updateAssets]);

  const reorderAssets = useCallback((from: number, to: number) => {
    const next = assetsRef.current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateAssets(next);
    workerRef.current?.postMessage({
      type: "reorder",
      ids: next.map((a) => a.id),
    });
  }, [updateAssets]);

  const changeRotation = useCallback(
    (degrees: number) => {
      if (!selectedAssetId) return;
      const normalized = ((Math.round(degrees) % 360) + 360) % 360;
      const next = assetsRef.current.map((a) =>
        a.id === selectedAssetId ? { ...a, rotation: normalized } : a,
      );
      updateAssets(next);
      workerRef.current?.postMessage({
        type: "rotations",
        rotations: [{ id: selectedAssetId, angle: normalized }],
      });
    },
    [selectedAssetId, updateAssets],
  );

  const selectedAsset =
    assets.find((a) => a.id === selectedAssetId) ?? null;

  useEffect(() => {
    const worker = new Worker(
      new URL("./workers/gif.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = (event) => handlerRef.current(event);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  handlerRef.current = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    switch (msg.type) {
      case "prepared":
        previewPendingRef.current = false;
        void applyPrepared(msg);
        break;
      case "preview": {
        const canvas = canvasRef.current;
        if (canvas) {
          const target = canvas.getContext("2d");
          if (target) target.drawImage(msg.bitmap, 0, 0);
        }
        msg.bitmap.close();
        previewPendingRef.current = false;
        break;
      }
      case "progress":
        setProgress({
          percent: msg.percent,
          phase: msg.phase,
          detail: msg.detail ?? null,
        });
        break;
      case "exported": {
        const blob = new Blob([msg.bytes], { type: "image/gif" });
        setDownloadUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setResult(msg.stats);
        setExporting(false);
        setExportHeight(380);
        previewPendingRef.current = false;
        break;
      }
      case "cancelled":
        setExporting(false);
        setExportHeight(120);
        previewPendingRef.current = false;
        break;
      case "error":
        setError(msg.message);
        setExporting(false);
        setPreparing(false);
        setExportHeight(120);
        previewPendingRef.current = false;
        break;
    }
  };

  const timeline = useMemo(
    () =>
      computeExportTimeline(
        assets.map((a) => a.meta?.durationMs ?? 0),
        config.maxDurationSec * 1000,
        config.sampleIntervalMs,
      ),
    [assets, config.maxDurationSec, config.sampleIntervalMs],
  );
  const durationRef = useRef(timeline.durationMs);
  durationRef.current = timeline.durationMs;

  const outputSize = useMemo(
    () => {
      let cellWidth = 1;
      let cellHeight = 1;
      for (const asset of assets) {
        if (asset.meta) {
          cellWidth = Math.max(cellWidth, asset.meta.width);
          cellHeight = Math.max(cellHeight, asset.meta.height);
        }
      }
      return computeOutputSize(assets.length, config, {
        width: cellWidth,
        height: cellHeight,
      });
    },
    [assets, config],
  );
  const aspect =
    outputSize.height > 0 ? outputSize.width / outputSize.height : 1;

  const handlePreviewSize = useCallback(
    (size: { width: number; height: number }) => {
      setPreviewSize(size);
    },
    [],
  );

  useEffect(() => {
    if (!playing || assets.length === 0 || exporting || preparing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const duration = durationRef.current;
      let t = playTimeRef.current + dt;
      if (duration > 0) t = t % duration;
      playTimeRef.current = t;
      if (now - lastUi > 100) {
        lastUi = now;
        setPlayTime(Math.floor(t));
      }
      requestPreview(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [assets.length, exporting, playing, preparing, requestPreview]);

  useEffect(() => {
    if (assets.length === 0 || playing || exporting || preparing) return;
    requestPreview(playTimeRef.current);
  }, [
    assets,
    config,
    exporting,
    playing,
    playTime,
    preparing,
    previewSize,
    requestPreview,
  ]);

  const handleSeek = useCallback((t: number) => {
    playTimeRef.current = t;
    setPlayTime(t);
    setPlaying(false);
  }, []);

  const handleExport = () => {
    const worker = workerRef.current;
    if (!worker || !canExport) return;
    setPlaying(false);
    setResult(null);
    setError(null);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProgress({ percent: 0, phase: "准备", detail: null });
    setExporting(true);
    setExportHeight(300);
    worker.postMessage({ type: "export", config: configRef.current });
  };

  const startDividerDrag = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = stageColRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const onMove = (ev: globalThis.MouseEvent) => {
        const next = rect.bottom - ev.clientY;
        setExportHeight(
          Math.max(120, Math.min(Math.round(next), rect.height - 160)),
        );
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.classList.remove("dragging-split");
      };
      document.body.classList.add("dragging-split");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const memoryWarn =
    estimatedMemory > MEMORY_WARN && estimatedMemory <= MEMORY_BLOCK;
  const memoryBlock = estimatedMemory > MEMORY_BLOCK;
  const outputBlock =
    outputSize.width > MAX_OUTPUT_SIDE || outputSize.height > MAX_OUTPUT_SIDE;
  const canExport =
    assets.length > 0 &&
    !preparing &&
    !exporting &&
    !memoryBlock &&
    !outputBlock;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span>
          GIF Array Workshop
        </div>
        <div className="topbar-note">所有处理均在本地浏览器完成</div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <UploadZone onFiles={(files) => void addFiles(files)} disabled={exporting} />
          {memoryWarn && (
            <div className="banner warn">
              解码内存预计约 {formatBytes(estimatedMemory)}，较大文件建议减少数量或降低输出。
            </div>
          )}
          {memoryBlock && (
            <div className="banner danger">
              解码内存预计约 {formatBytes(estimatedMemory)}，超过 900MB 保护上限，请减少 GIF 数量后再导出。
            </div>
          )}
          <AssetList
            assets={assets}
            selectedId={selectedAssetId}
            onSelect={setSelectedAssetId}
            onRemove={removeAsset}
            onReorder={reorderAssets}
            onClear={clearAssets}
          />
          <SettingsPanel
            config={config}
            selectedAssetName={selectedAsset?.name ?? null}
            rotation={selectedAsset?.rotation ?? 0}
            onRotationChange={changeRotation}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            disabled={exporting}
          />
          {outputBlock && (
            <div className="banner danger">
              输出画布 {outputSize.width}×{outputSize.height} 超过 4096px 上限，请降低输出大小或列数。
            </div>
          )}
          {error && <div className="banner danger">{error}</div>}
          <button
            type="button"
            className="export-btn"
            onClick={handleExport}
            disabled={!canExport}
          >
            <Sparkles size={16} /> 开始智能导出
          </button>
          <p className="export-hint">
            输出 {outputSize.width}×{outputSize.height} · {timeline.frameCount} 帧 · 约{" "}
            {formatMs(timeline.durationMs)}
          </p>
        </aside>
        <main className="stage-col" ref={stageColRef}>
          <PreviewStage
            canvasRef={canvasRef}
            hasAssets={assets.length > 0}
            playing={playing}
            playTime={playTime}
            durationMs={timeline.durationMs}
            exporting={exporting}
            aspect={aspect}
            onPreviewSize={handlePreviewSize}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSeek={handleSeek}
          />
          <div
            className="splitter"
            onMouseDown={startDividerDrag}
            title="拖动调整预览与导出结果的大小"
          >
            <GripHorizontal size={16} />
          </div>
          <ExportPanel
            exporting={exporting}
            progress={{
              percent: progress.percent,
              phase: progress.phase,
              detail: progress.detail,
            }}
            result={result}
            downloadUrl={downloadUrl}
            error={error}
            height={exportHeight}
            onCancel={() => workerRef.current?.postMessage({ type: "cancel" })}
          />
        </main>
      </div>
    </div>
  );
}
