export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)} 秒`;
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m} 分 ${s} 秒`;
}

export function formatReduction(before: number, after: number): string {
  if (before <= 0) return "-";
  const pct = ((before - after) / before) * 100;
  return `${pct >= 0 ? "缩小" : "增大"} ${Math.abs(pct).toFixed(1)}%`;
}
