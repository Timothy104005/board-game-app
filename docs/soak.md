# Soak Verification

`verify:soak` is a long-running deterministic verification pass for the full repo workflow.
`verify:overnight` is the expanded overnight hardening pass with simulation, tuning, and rulebook command coverage.

## Purpose

- Stress test baseline stability while unattended.
- Validate simulation outputs over larger match counts.
- Validate rulebook pipeline behavior across all bundled examples.
- Produce a single summary artifact with pass/fail and key metrics.

## Run

```bash
npm run verify:soak
npm run verify:overnight
```

## Expected Runtime Characteristics

- Runs `npm test`.
- Runs higher-volume sims for Tic-Tac-Toe and Splendor (`matches=200`).
- Runs rulebook pipeline for all examples (`tictactoe`, `pig`, `nim`, `connect4`, `mini_splendor`, `unknown`).
- Writes per-command logs and a final summary.

`verify:overnight` additionally:

- Runs higher-volume sims (`matches=500`) for Tic-Tac-Toe and Splendor.
- Runs tuning smoke plus medium Splendor tuning sweep (`iters=10`, `cand=30`, `matches=200`).
- Runs all `rb:run:*` scripts discovered from `package.json`, sorted by script name.
- Writes per-command logs and a manifest with command outcomes and key metrics.

## Output Structure

Outputs are written under:

- `artifacts/soak/YYYYMMDD-HHMMSS/`
- `artifacts/overnight/YYYYMMDD-HHMMSS/`

Inside each run folder:

- `logs/` command stdout/stderr logs
- `sim/` copied simulation JSON outputs for soak seeds
- `rulebook_run/` rulebook pipeline outputs
- `summary.json` aggregate run result and key metrics
- `manifest.json` for overnight runs: git commit, node version, commands, exit codes, and extracted metrics

## Reproducibility

- Use fixed seed values in scripts and command args.
- Keep `FASTCHECK_RUNS` fixed when comparing overnight runs.
- Capture the generated manifest path and associated command logs.

## Unknown Rulebook Behavior

`unknown.rulebook.txt` is expected to return non-zero from `rulebookRun` due unresolved error gaps.
In `verify:soak`, this non-zero exit is treated as expected and marked as pass when it matches expected exit code `1`.
