import { Download, Loader2, X } from "lucide-react";
import type { ExportStats } from "../types";
import { formatBytes, formatMs } from "../lib/format";

interface ExportPanelProps {
  exporting: boolean;
  progress: { percent: number; phase: string; detail: string | null };
  result: ExportStats | null;
  downloadUrl: string | null;
  error: string | null;
  height: number;
  fileName: string;
  exportName: string;
  onExportNameChange: (value: string) => void;
  onCancel: () => void;
  frameCount: number;
  durationMs: number;
}

export function ExportPanel({
  exporting,
  progress,
  result,
  downloadUrl,
  error,
  height,
  fileName,
  exportName,
  onExportNameChange,
  onCancel,
  frameCount,
  durationMs,
}: ExportPanelProps) {
  const canDownload = Boolean(result && downloadUrl);
  const after = result ? formatBytes(result.finalSizeBytes) : "—";
  const frames = result ? result.frameCount : frameCount;
  const duration = result ? formatMs(result.durationMs) : formatMs(durationMs);
  const metaName = fileName || exportName;

  return (
    <section className="export-panel" style={{ height, overflowY: "auto" }}>
      <div className="export-name-row">
        <label htmlFor="exportName">导出名称</label>
        <input
          id="exportName"
          type="text"
          value={exportName}
          maxLength={60}
          disabled={exporting}
          onChange={(e) => onExportNameChange(e.target.value)}
        />
        <span>自动追加时间戳</span>
      </div>

      {exporting && (
        <>
          <div className="export-row">
            <Loader2 className="spin" size={18} />
            <div className="export-status">
              <strong>{progress.phase}</strong>
              {progress.detail && <span>{progress.detail}</span>}
            </div>
            <button type="button" className="ghost-btn" onClick={onCancel}>
              <X size={15} /> 取消
            </button>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="progress-label">{progress.percent}%</span>
        </>
      )}

      {error && !exporting && <div className="banner danger">{error}</div>}

      <div className="export-head">
        {canDownload ? (
          <a className="primary-btn" href={downloadUrl!} download={fileName}>
            <Download size={16} /> 下载 GIF（{after}）
          </a>
        ) : (
          <button type="button" className="primary-btn" disabled>
            <Download size={16} /> 下载 GIF
          </button>
        )}
      </div>

      <p className="export-meta">
        {frames} 帧 · {duration} · {metaName}
      </p>
    </section>
  );
}
