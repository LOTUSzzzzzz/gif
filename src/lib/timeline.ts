export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return Math.max(a, b);
  return Math.abs(Math.round(a / gcd(a, b)) * Math.round(b));
}

export interface ExportTimeline {
  durationMs: number;
  frameCount: number;
  intervalMs: number;
}

export function computeExportTimeline(
  durationsMs: number[],
  maxDurationMs: number,
  intervalMs: number,
): ExportTimeline {
  const positive = durationsMs.filter((d) => d > 0);
  const combined = positive.reduce(lcm, 1);
  const capped = Math.min(combined, Math.max(intervalMs, maxDurationMs));
  const frameCount = Math.max(1, Math.ceil(capped / intervalMs));
  return { durationMs: frameCount * intervalMs, frameCount, intervalMs };
}

export function buildCumulative(delays: number[]): number[] {
  const result: number[] = [];
  let acc = 0;
  for (const delay of delays) {
    acc += delay;
    result.push(acc);
  }
  return result;
}

export function frameIndexAt(
  cumulativeDelays: number[],
  durationMs: number,
  t: number,
): number {
  if (cumulativeDelays.length === 0 || durationMs <= 0) return 0;
  const tMod = ((t % durationMs) + durationMs) % durationMs;
  let lo = 0;
  let hi = cumulativeDelays.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeDelays[mid] <= tMod) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function sampleIndexes(frameCount: number, maxSamples = 10): number[] {
  if (frameCount <= maxSamples) {
    return Array.from({ length: frameCount }, (_, i) => i);
  }
  const step = (frameCount - 1) / (maxSamples - 1);
  return Array.from({ length: maxSamples }, (_, i) => Math.round(i * step));
}
