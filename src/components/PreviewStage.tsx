import { useEffect, useRef } from "react";
import previewBgUrl from "../assets/preview-bg.mp4";

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasAssets: boolean;
  aspect: number;
  onPreviewSize: (size: { width: number; height: number }) => void;
}

export function PreviewStage({
  canvasRef,
  hasAssets,
  aspect,
  onPreviewSize,
}: PreviewStageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastRenderRef = useRef({ width: 0, height: 0 });
  const MAX_RENDER_SIDE = 2048;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const availableWidth = Math.max(240, Math.floor(rect.width - 8));
      const availableHeight = Math.max(200, Math.floor(rect.height - 8));
      const ratio = aspect > 0 ? aspect : 1;
      let width = availableWidth;
      let height = Math.floor(width / ratio);
      if (height > availableHeight) {
        height = availableHeight;
        width = Math.max(1, Math.floor(height * ratio));
      }

      let renderWidth = Math.min(
        MAX_RENDER_SIDE,
        Math.max(1, Math.round(width)),
      );
      let renderHeight = Math.max(1, Math.round(renderWidth / ratio));
      if (renderHeight > MAX_RENDER_SIDE) {
        renderHeight = MAX_RENDER_SIDE;
        renderWidth = Math.max(1, Math.round(renderHeight * ratio));
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
      <video
        className="stage-bg"
        src={previewBgUrl}
        autoPlay
        loop
        muted
        playsInline
      />
      {!hasAssets ? (
        <div className="stage-empty">
          从左侧添加 GIF 后，这里会显示阵列预览
        </div>
      ) : (
        <canvas ref={canvasRef} className="stage-canvas" />
      )}
    </div>
  );
}
