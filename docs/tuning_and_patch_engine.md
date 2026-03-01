# Milestone 4: Tuning + Restricted Patch Engine

This milestone introduces a deterministic tuning loop over IR using restricted patch operations.
It produces reproducible A/B reports without changing core game runtime architecture.

## Objective Function

The tuner computes derived metrics from simulation batch output:

- `winRateBySeat`
- `drawRate`
- `avgTurns`
- `firstPlayerAdvantage = winRate("0") - mean(winRateBySeat)`
- `actionEntropy = -sum(p * log2(p))`

Scalar objective (lower is better):

```text
fairnessPenalty      = stddev(winRateBySeat)
firstPlayerPenalty   = abs(firstPlayerAdvantage)
turnPenalty          = abs(avgTurns - targetAvgTurns) / max(1, targetAvgTurns)
entropyPenalty       = -actionEntropy

score =
  fairnessWeight * fairnessPenalty +
  firstPlayerWeight * firstPlayerPenalty +
  turnTargetWeight * turnPenalty +
  entropyWeight * entropyPenalty
```

Default weights:

- `fairnessWeight = 1`
- `firstPlayerWeight = 1`
- `turnTargetWeight = 1`
- `entropyWeight = 1`
- `targetAvgTurns = 20`

## Patch Space (v0)

Current implemented space: `mini_splendor`.

Knobs:

- `tokenLimit` in `[8,12]`
- `endScoreTarget` in `[10,20]` (`end.kind = "score_at_least"`)
- bounded card tweaks:
  - cost delta `±1`, clamped `[0,7]`
  - points delta `±1`, clamped `[0,5]`

Constraints:

- card pool size unchanged
- all costs and points non-negative and within bounds
- `tokenLimit >= 0`
- if `end.kind = "score_at_least"`, then `target >= 1`

## Restricted Patch Engine

Supported operations:

- `set`
- `append`
- `merge`

Safety guardrails:

- path-based updates only (JSON pointer style)
- invalid operations are rejected with deterministic errors
- candidate IR must pass schema parse + checker before simulation
- patch-space constraints run after checker

## Deterministic Tuning Flow

1. Validate baseline IR (schema + checker + compile).
2. Simulate baseline with fixed seed and deterministic bot setup.
3. Generate candidates from patch space with seed-derived PRNG.
4. For each candidate:
   - apply patch
   - validate schema/checker/constraints
   - compile and simulate
   - compute objective
5. Keep strictly better candidate (`newScore < bestScore`).
6. Stop early when no improvement reaches `stagnationPatience`.

## Reproducing a Tuning Run

Smoke run (fast):

```bash
npm run tune:smoke
```

Full run:

```bash
npm run tune:splendor
```

Both commands write to:

- `artifacts/tuning/YYYYMMDD-HHMMSS/`

## A/B Report Outputs

Each run writes:

- `report.md`
- `report.json`
- `best.patch.json`
- `best.ir.json`

How to read:

- compare baseline vs best objective score
- inspect objective breakdown penalties
- review patch ops applied to produce best candidate
- verify reproducibility block (seed, iter/candidate counts, sim config, bot mode)
