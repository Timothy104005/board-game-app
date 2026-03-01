export const FASTCHECK_DEFAULT_SEED = 20260302;
const DEFAULT_RUNS = 50;

export function getFastCheckRuns(): number {
  const raw = process.env.FASTCHECK_RUNS;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RUNS;
  }
  return parsed;
}

export const FASTCHECK_PARAMETERS = {
  seed: FASTCHECK_DEFAULT_SEED,
  numRuns: getFastCheckRuns()
} as const;
