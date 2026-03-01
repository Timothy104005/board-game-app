# Artifacts Policy

Generated outputs from simulation and rulebook pipelines are written under `./artifacts/`.

## Directories

- `artifacts/replays/`: simulation outputs from `scripts/simulate.ts`
- `artifacts/rulebook_ir/`: outputs from `scripts/rulebook2ir.ts`
- `artifacts/rulebook_run/`: outputs from `scripts/rulebookRun.ts`

## Discipline

- Artifacts are deterministic for the same inputs and seed.
- Artifacts are not source of truth and are ignored by git.
- Keep output filenames stable so regression tooling can compare results.
