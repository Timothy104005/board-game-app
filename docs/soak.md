# Soak Verification

`verify:soak` is a long-running deterministic verification pass for the full repo workflow.

## Purpose

- Stress test baseline stability while unattended.
- Validate simulation outputs over larger match counts.
- Validate rulebook pipeline behavior across all bundled examples.
- Produce a single summary artifact with pass/fail and key metrics.

## Run

```bash
npm run verify:soak
```

## Expected Runtime Characteristics

- Runs `npm test`.
- Runs higher-volume sims for Tic-Tac-Toe and Splendor (`matches=200`).
- Runs rulebook pipeline for all examples (`tictactoe`, `pig`, `nim`, `connect4`, `mini_splendor`, `unknown`).
- Writes per-command logs and a final summary.

## Output Structure

Outputs are written under:

- `artifacts/soak/YYYYMMDD-HHMMSS/`

Inside each run folder:

- `logs/` command stdout/stderr logs
- `sim/` copied simulation JSON outputs for soak seeds
- `rulebook_run/` rulebook pipeline outputs
- `summary.json` aggregate run result and key metrics

## Unknown Rulebook Behavior

`unknown.rulebook.txt` is expected to return non-zero from `rulebookRun` due unresolved error gaps.
In `verify:soak`, this non-zero exit is treated as expected and marked as pass when it matches expected exit code `1`.
