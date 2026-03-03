# Milestones

| Milestone | Status | Scope | Evidence | Next Actions |
|---|---|---|---|---|
| M1 Engine Contract + Invariants | DONE | Engine contract, invariant gate, deterministic step model | Commands: `npm test -- --coverage`<br>Artifacts: `artifacts/replays/*.json` | Keep deterministic checks green while expanding games |
| M2 IR v0 + Compiler | DONE | Zod schema, checker, compileToGameModule, integration tests | Commands: `npm test -- --coverage`, `npm run rb:run:tictactoe`<br>Artifacts: `artifacts/rulebook_run/*.ir.json` | Add more action kinds with checker parity |
| M3 Rulebook Pipeline + Simulation Workflow | DONE | Rulebook extraction quality, deterministic compile/sim pipeline, artifactized reports | Commands: `npm run rb:run:tictactoe`, `npm run rb:run:pig`<br>Artifacts: `artifacts/rulebook_run/*.sim.summary.json`, `artifacts/rulebook_run/*.replay.sample.json` | Keep extraction quality visible with regression tests |
| M4 Tuning + Restricted Patch Engine | DONE | Fairness/turn-length tuning and safe patch policy | Commands: `npm run tune:smoke`, `npm test -- --coverage`<br>Artifacts: `artifacts/tuning/*/report.json`, `artifacts/jobs/*/tune.report.json` | Expand tuning spaces with stricter acceptance thresholds |
| M5 Productization (Web SaaS) | IN PROGRESS | Next.js dashboard, durable jobs queue, worker daemon, PDF upload ingestion, replay/artifact viewer, E2E and split CI | Commands: `npm run jobs:worker`, `cd apps/web && npm run dev`, `npm run jobs:smoke`, `cd apps/web && npm test -- --grep "critical flow"`<br>Artifacts: `artifacts/jobs/*`, `artifacts/projects/*/uploads/*.pdf`, `artifacts/projects/*/runs/*`, `artifacts/schoolday/*/summary.json` | Continue deployment packaging and operational runbook hardening |

## Checklist

- [x] M1: Engine contract + no-dead-end/determinism/resource-bound gates
- [x] M2: IR schema/checker/compiler + integration tests
- [x] M3: Rulebook workflow operational hardening and packaging
- [x] M4: Tuning and restricted patch engine automation
- [ ] M5: SaaS productization and operations (in progress via `apps/web` + `src/jobs`)

## M5 Evidence Commands

1. `npm run jobs:worker`
2. `cd apps/web && npm run dev`
3. Open `http://localhost:3000/projects/new`
4. Create project from rulebook text
5. Run `Run Rulebook` then open run page artifacts
6. Upload PDF rulebook on `/projects/[id]` and run `Run from PDF`
7. Open run page and verify `ir`, `gaps`, `patchTemplate`, `sampleReplay`
8. `npm run jobs:smoke`
