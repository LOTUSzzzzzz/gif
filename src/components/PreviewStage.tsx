import { useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { formatMs } from "../lib/format";

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasAssets: boolean;
  playing: boolean;
  playTime: number;
  durationMs: number;
  exporting: boolean;
  aspect: number;
  onPreviewSize: (size: { width: number; height: number }) => void;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
}

export function PreviewStage({
  canvasRef,
  hasAssets,
  playing,
  playTime,
  durationMs,
  exporting,
  aspect,
  onPreviewSize,
  onTogglePlay,
  onSeek,
}: PreviewStageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastRenderRef = useRef({ width: 0, height: 0 });
  const MAX_RENDER_SIDE = 1280;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const availableWidth = Math.max(240, Math.floor(rect.width - 32));
      const availableHeight = Math.max(200, Math.floor(rect.height - 32));
      const ratio = aspect > 0 ? aspect : 1;
      let width = availableWidth;
      let height = Math.floor(width / ratio);
      if (height > availableHeight) {
        height = availableHeight;
        width = Math.max(1, Math.floor(height * ratio));
      }
      let renderWidth = MAX_RENDER_SIDE;
      let renderHeight = Math.max(1, Math.round(MAX_RENDER_SIDE / ratio));
      if (renderHeight > MAX_RENDER_SIDE) {
        renderHeight = MAX_RENDER_SIDE;
        renderWidth = Math.max(1, Math.round(MAX_RENDER_SIDE * ratio));
      }
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
          canvas.width = renderWidth;
          canvas.height = renderHeight;
        }
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      if (
        lastRenderRef.current.width !== renderWidth ||
        lastRenderRef.current.height !== renderHeight
      ) {
        lastRenderRef.current = { width: renderWidth, height: renderHeight };
        onPreviewSize({ width: renderWidth, height: renderHeight });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspect, canvasRef, hasAssets, onPreviewSize]);

  return (
    <div className="stage" ref={boxRef}>
      {!hasAssets ? (
        <div className="stage-empty">
          从左侧添加 GIF 后，这里会显示阵列预览
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="stage-canvas" />
          <div className="stage-controls">
            <button
              type="button"
              className="play-btn"
              title={playing ? "暂停" : "播放"}
              onClick={onTogglePlay}
              disabled={exporting}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <input
              className="time-slider"
              type="range"
              min={0}
              max={Math.max(1, durationMs)}
              step={10}
              value={Math.min(playTime, Math.max(1, durationMs))}
              disabled={exporting}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span className="time-label">
              {formatMs(playTime)} / {formatMs(durationMs)}
            </span>
            {exporting && <span className="exporting-label">导出中…</span>}
          </div>
        </>
      )}
    </div>
  );
}
