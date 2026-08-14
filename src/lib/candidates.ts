import type { CandidateResult, CandidateSpec } from "../types";

export const CANDIDATES: CandidateSpec[] = [
  { lossy: 0, colors: 256 },
  { lossy: 30, colors: 256 },
  { lossy: 60, colors: 256 },
  { lossy: 90, colors: 128 },
  { lossy: 120, colors: 128 },
  { lossy: 150, colors: 64 },
  { lossy: 200, colors: 64 },
];

export function selectBestCandidate(
  results: CandidateResult[],
  threshold: number,
): CandidateSpec {
  if (results.length === 0) return { lossy: 0, colors: 256 };
  const accepted = results.filter((r) => r.accepted && r.ssim >= threshold);
  const pool = accepted.length > 0 ? accepted : results;
  return pool.reduce((best, r) =>
    r.sizeBytes < best.sizeBytes ? r : best,
  ).spec;
}
