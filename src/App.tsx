import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pause, Play, Sparkles } from "lucide-react";
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
import {
  effectiveSampleIntervalMs,
  gridCellCount,
  MAX_EXPORT_SIDE,
} from "./lib/exportPolicy";
import { computeOutputSize } from "./lib/layout";
import {
  buildExportFileNameWithTimestamp,
  formatBytes,
  formatMs,
} from "./lib/format";

const DEFAULT_CONFIG: GridConfig = {
  columns: 1,
  rows: 1,
  gap: 0,
  backgroundColor: "transparent",
  scale: 1,
  sampleIntervalMs: 50,
  ssimThreshold: 0.95,
};

const MEMORY_WARN = 300 * 1024 * 1024;
const MEMORY_BLOCK = 900 * 1024 * 1024;
const MAX_OUTPUT_SIDE = MAX_EXPORT_SIDE;

function bitmapToDataUrl(bitmap: ImageBitmap): string {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const target = canvas.getContext("2d")!;
  target.drawImage(bitmap, 0, 0);
  return canvas.toDataURL("image/png");
}

function currentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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
  const [exportHeight, setExportHeight] = useState(200);
  const [progress, setProgress] = useState({
    percent: 0,
    phase: "",
    detail: null as string | null,
  });
  const [result, setResult] = useState<ExportStats | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("GIF");
  const [exportTimestamp, setExportTimestamp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<"single" | "all">("single");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const previewPendingRef = useRef(false);
  const lastPreviewStateRef = useRef({ key: "", t: 0 });
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
    const payloads = list.map((a, i) => ({
      id: a.id,
      buffer: buffers[i],
      rotation: a.rotation ?? 0,
      speed: a.speed ?? 1,
    }));
    worker.postMessage(
      { type: "prepare", assets: payloads },
      payloads.map((p) => p.buffer),
    );
  }, []);

  const applyPrepared = useCallback(
    async (msg: Extract<WorkerResponse, { type: "prepared" }>) => {
      const metaById = new Map(msg.meta.map((m) => [m.id, m.meta]));
      const urlById = new Map(
        msg.thumbnails.map((t) => [t.id, bitmapToDataUrl(t.bitmap)]),
      );
      const next = assetsRef.current.map((a) => ({
        ...a,
        meta: metaById.get(a.id) ?? a.meta,
        previewUrl: urlById.get(a.id) ?? a.previewUrl,
      }));
      updateAssets(next);
      setEstimatedMemory(msg.estimatedMemoryBytes);
      setSelectedAssetId((prev) => prev ?? (msg.meta[0]?.id ?? null));
      setPreparing(false);
    },
    [updateAssets],
  );

  const currentPreviewKey = () =>
    JSON.stringify({
      config: configRef.current,
      width: previewSizeRef.current.width,
      height: previewSizeRef.current.height,
      assets: assetsRef.current.map((a) => a.id).join(","),
    });

  const requestPreview = useCallback((t: number) => {
    const worker = workerRef.current;
    if (!worker || assetsRef.current.length === 0 || previewPendingRef.current) {
      return;
    }
    const size = previewSizeRef.current;
    previewPendingRef.current = true;
    lastPreviewStateRef.current = { key: currentPreviewKey(), t };
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
          speed: 1,
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

  const changeSpeed = useCallback(
    (speed: number) => {
      const clamped = Math.max(1, Math.min(5, Math.round(speed)));
      const matches =
        speedMode === "all"
          ? () => true
          : (a: GifAsset) => a.id === selectedAssetId;
      const next = assetsRef.current.map((a) =>
        matches(a) ? { ...a, speed: clamped } : a,
      );
      updateAssets(next);
      const speeds = next
        .filter((a) => speedMode === "all" || a.id === selectedAssetId)
        .map((a) => ({ id: a.id, speed: a.speed }));
      workerRef.current?.postMessage({ type: "speeds", speeds });
    },
    [selectedAssetId, speedMode, updateAssets],
  );

  const changeSpeedMode = useCallback(
    (mode: "single" | "all") => {
      setSpeedMode(mode);
      if (mode !== "all") return;
      const value =
        assetsRef.current.find((a) => a.id === selectedAssetId)?.speed ?? 1;
      const next = assetsRef.current.map((a) => ({ ...a, speed: value }));
      updateAssets(next);
      workerRef.current?.postMessage({
        type: "speeds",
        speeds: next.map((a) => ({ id: a.id, speed: a.speed })),
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
      workerRef.current?.terminate();
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
          if (target) {
            target.clearRect(0, 0, canvas.width, canvas.height);
            target.drawImage(msg.bitmap, 0, 0);
          }
        }
        msg.bitmap.close();
        previewPendingRef.current = false;
        const last = lastPreviewStateRef.current;
        const stale =
          currentPreviewKey() !== last.key ||
          Math.abs(playTimeRef.current - last.t) > 40;
        if (stale) requestPreview(playTimeRef.current);
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
        setExportTimestamp(currentTimestamp());
        setDownloadUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setResult(msg.stats);
        setExporting(false);
        setExportHeight(200);
        previewPendingRef.current = false;
        break;
      }
      case "cancelled":
        setExporting(false);
        setExportHeight(200);
        previewPendingRef.current = false;
        break;
      case "error":
        setError(msg.message);
        setExporting(false);
        setPreparing(false);
        setExportHeight(200);
        previewPendingRef.current = false;
        break;
    }
  };

  const timeline = useMemo(() => {
    const cellCount = gridCellCount(
      assets.length,
      config.columns,
      config.rows,
    );
    const intervalMs = effectiveSampleIntervalMs(
      config.sampleIntervalMs,
      cellCount,
    );
    const durations = assets.map(
      (a) => (a.meta?.durationMs ?? 0) / (a.speed ?? 1),
    );
    const longestDurationMs = Math.max(intervalMs, ...durations);
    return computeExportTimeline(
      durations,
      longestDurationMs,
      intervalMs,
    );
  }, [
    assets,
    config.columns,
    config.rows,
    config.sampleIntervalMs,
  ]);
  const durationRef = useRef(timeline.durationMs);
  durationRef.current = timeline.durationMs;

  const autoOutputSize = useMemo(() => {
    if (assets.length === 0) return { width: 0, height: 0 };
    let cellWidth = 1;
    let cellHeight = 1;
    for (const asset of assets) {
      if (asset.meta) {
        cellWidth = Math.max(cellWidth, asset.meta.width);
        cellHeight = Math.max(cellHeight, asset.meta.height);
      }
    }
    const computed = computeOutputSize(assets.length, config, {
      width: cellWidth,
      height: cellHeight,
    });
    return {
      width: Math.min(MAX_EXPORT_SIDE, computed.width),
      height: Math.min(MAX_EXPORT_SIDE, computed.height),
    };
  }, [assets, config]);
  const outputSize = useMemo(
    () => ({
      width:
        config.outputWidth && config.outputWidth > 0
          ? Math.min(MAX_EXPORT_SIDE, config.outputWidth)
          : autoOutputSize.width,
      height:
        config.outputHeight && config.outputHeight > 0
          ? Math.min(MAX_EXPORT_SIDE, config.outputHeight)
          : autoOutputSize.height,
    }),
    [autoOutputSize, config.outputWidth, config.outputHeight],
  );
  const aspect =
    outputSize.height > 0 ? outputSize.width / outputSize.height : 1;

  const setOutputSize = useCallback(
    (size: { width: number; height: number }) => {
      setConfig((c) => ({
        ...c,
        outputWidth: size.width,
        outputHeight: size.height,
      }));
    },
    [],
  );

  const resetOutputSize = useCallback(() => {
    setConfig((c) => {
      const next = { ...c };
      delete next.outputWidth;
      delete next.outputHeight;
      return next;
    });
  }, []);

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

  const cancelExport = useCallback(() => {
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL("./workers/gif.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = (event) => handlerRef.current(event);
    setExporting(false);
    setExportHeight(200);
    previewPendingRef.current = false;
    void sendPrepare(assetsRef.current);
  }, [sendPrepare]);

  const handleExport = () => {
    const worker = workerRef.current;
    if (!worker || !canExport) return;
    setPlaying(false);
    setResult(null);
    setExportTimestamp("");
    setError(null);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProgress({ percent: 0, phase: "准备", detail: null });
    setExporting(true);
    setExportHeight(200);
    worker.postMessage({ type: "export", config: configRef.current });
  };

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

  const exportFileName = exportTimestamp
    ? buildExportFileNameWithTimestamp(exportName, exportTimestamp)
    : "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span>
          GIF Array Workshop
        </div>
        <div className="topbar-note">所有处理均在本地浏览器完成</div>
        <div className="topbar-note">网站禁止商用，由蓝莲花制作</div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-scroll">
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
              outputSize={outputSize}
              autoOutputSize={autoOutputSize}
              onOutputSizeChange={setOutputSize}
              onOutputSizeReset={resetOutputSize}
              rotation={selectedAsset?.rotation ?? 0}
              speed={selectedAsset?.speed ?? 1}
              speedMode={speedMode}
              onSpeedModeChange={changeSpeedMode}
              onRotationChange={changeRotation}
              onSpeedChange={changeSpeed}
              onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
              disabled={exporting}
            />
            {outputBlock && (
              <div className="banner danger">
                输出画布 {outputSize.width}×{outputSize.height} 超过 1024px 上限，请降低输出大小或列数。
              </div>
            )}
            {error && <div className="banner danger">{error}</div>}
          </div>
          <div className="sidebar-footer">
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
          </div>
        </aside>
        <main className="stage-col">
          <PreviewStage
            canvasRef={canvasRef}
            hasAssets={assets.length > 0}
            aspect={aspect}
            onPreviewSize={handlePreviewSize}
          />
          <section className="preview-export-panel">
            <div className="playback-bar">
              <button
                type="button"
                className="play-btn"
                title={playing ? "暂停" : "播放"}
                onClick={() => setPlaying((p) => !p)}
                disabled={exporting}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                className="time-slider"
                type="range"
                min={0}
                max={Math.max(1, timeline.durationMs)}
                step={10}
                value={Math.min(playTime, Math.max(1, timeline.durationMs))}
                disabled={exporting}
                onChange={(e) => handleSeek(Number(e.target.value))}
              />
              <span className="time-label">
                {formatMs(playTime)} / {formatMs(timeline.durationMs)}
              </span>
              {exporting && <span className="exporting-label">导出中…</span>}
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
            fileName={exportFileName}
            exportName={exportName}
            onExportNameChange={setExportName}
            frameCount={timeline.frameCount}
            durationMs={timeline.durationMs}
            onCancel={cancelExport}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
