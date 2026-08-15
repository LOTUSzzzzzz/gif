import { Download, Loader2, X } from "lucide-react";
import type { ExportStats } from "../types";
import { formatBytes, formatMs, formatReduction } from "../lib/format";

interface ExportPanelProps {
  exporting: boolean;
  progress: { percent: number; phase: string; detail: string | null };
  result: ExportStats | null;
  downloadUrl: string | null;
  error: string | null;
  height: number;
  fileName: string;
  onCancel: () => void;
}

export function ExportPanel({
  exporting,
  progress,
  result,
  downloadUrl,
  error,
  height,
  fileName,
  onCancel,
}: ExportPanelProps) {
  if (exporting) {
    return (
      <section className="export-panel" style={{ height, overflowY: "auto" }}>
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
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="progress-label">{progress.percent}%</span>
      </section>
    );
  }

  if (result && downloadUrl) {
    return (
      <section className="export-panel" style={{ height, overflowY: "auto" }}>
        <div className="export-head">
          <h2>导出结果</h2>
          <a className="primary-btn" href={downloadUrl} download={fileName}>
            <Download size={16} /> 下载 GIF（{formatBytes(result.finalSizeBytes)}）
          </a>
        </div>
        <div className="stats-grid">
          <div className="stat">
            <span>原文件合计</span>
            <strong>{formatBytes(result.totalSourceBytes)}</strong>
          </div>
          <div className="stat">
            <span>压缩前</span>
            <strong>{formatBytes(result.baselineSizeBytes)}</strong>
          </div>
          <div className="stat">
            <span>压缩后</span>
            <strong>{formatBytes(result.finalSizeBytes)}</strong>
          </div>
          <div className="stat">
            <span>体积变化</span>
            <strong>
              {formatReduction(result.baselineSizeBytes, result.finalSizeBytes)}
            </strong>
          </div>
          <div className="stat">
            <span>画质 SSIM</span>
            <strong>{result.ssim.toFixed(4)}</strong>
          </div>
          <div className="stat">
            <span>采用参数</span>
            <strong>
              lossy {result.chosen.lossy} · {result.chosen.colors} 色
            </strong>
          </div>
        </div>
        <p className="export-meta">
          {result.outputWidth}×{result.outputHeight} · {result.frameCount} 帧 ·{" "}
          {formatMs(result.durationMs)}
        </p>
        {result.candidates.length > 1 && (
          <div className="candidate-table">
            {result.candidates.map((c) => (
              <div
                key={`${c.spec.lossy}-${c.spec.colors}`}
                className={`candidate-row${
                  c.spec === result.chosen ? " chosen" : ""
                }`}
              >
                <span className="candidate-params">
                  lossy {c.spec.lossy} / {c.spec.colors} 色
                </span>
                <span>{formatBytes(c.sizeBytes)}</span>
                <span>SSIM {c.ssim.toFixed(3)}</span>
                <span className={c.accepted ? "tag ok" : "tag bad"}>
                  {c.accepted ? "达标" : "未达阈值"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="export-panel" style={{ height, overflowY: "auto" }}>
      <div className="export-idle">
        <strong>等待导出</strong>
        <span>配置好网格后，点击左侧「开始智能导出」</span>
        {error && <span className="error-text">{error}</span>}
      </div>
    </section>
  );
}
