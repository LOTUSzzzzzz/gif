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

export function buildExportFileName(customName: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return buildExportFileNameWithTimestamp(customName, timestamp);
}

export function buildExportFileNameWithTimestamp(
  customName: string,
  timestamp: string,
): string {
  const base = customName.trim() || "gif-grid";
  return `${base}_${timestamp}.gif`;
}
