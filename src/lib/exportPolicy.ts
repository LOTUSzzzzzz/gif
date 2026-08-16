export function gridCellCount(
  assetCount: number,
  columns: number,
  rows: number,
): number {
  const cols = Math.max(1, Math.min(50, Math.round(columns)));
  const resolvedRows =
    rows > 0
      ? Math.max(1, Math.min(50, Math.round(rows)))
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
