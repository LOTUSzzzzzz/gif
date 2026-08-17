export const MAX_EXPORT_SIDE = 1024;
export const TARGET_EXPORT_BYTES = 500 * 1024;
export const EXPORT_SIDES = [1024, 768, 640, 512, 384, 320] as const;

export function gridCellCount(
  assetCount: number,
  columns: number,
  rows: number,
): number {
  const cols = Math.max(1, Math.min(10, Math.round(columns)));
  const resolvedRows =
    rows > 0
      ? Math.max(1, Math.min(10, Math.round(rows)))
      : Math.max(1, Math.ceil(assetCount / cols));
  return cols * resolvedRows;
}

export function effectiveSampleIntervalMs(
  sampleIntervalMs: number,
  cellCount: number,
): number {
  return cellCount >= 64 ? Math.max(sampleIntervalMs, 100) : sampleIntervalMs;
}

export function effectiveSsimThreshold(
  threshold: number,
  cellCount: number,
): number {
  const cap = cellCount >= 64 ? 0.9 : 0.98;
  return Math.min(threshold, cap);
}
