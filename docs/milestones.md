# Milestones

| Milestone | Status | Scope | Evidence | Next Actions |
|---|---|---|---|---|
| M1 Engine Contract + Invariants | DONE | Engine contract, invariant gate, deterministic step model | Commands: `npm test -- --coverage`<br>Artifacts: `artifacts/replays/*.json` | Keep deterministic checks green while expanding games |
| M2 IR v0 + Compiler | DONE | Zod schema, checker, compileToGameModule, integration tests | Commands: `npm test -- --coverage`, `npm run rb:run:tictactoe`<br>Artifacts: `artifacts/rulebook_run/*.ir.json` | Add more action kinds with checker parity |
| M3 Rulebook Pipeline + Simulation Workflow | TODO | Rulebook extraction quality, ops hardening, reviewer workflow completion | Commands: `npm run rb:run:tictactoe`, `npm run rb:run:pig`<br>Artifacts: `artifacts/rulebook_run/*.sim.summary.json` | Complete ops polish, soak verification, CI visibility |
| M4 Tuning + Restricted Patch Engine | IN PROGRESS | Fairness/turn-length tuning and safe patch policy | Commands: `npm run tune:smoke`<br>Artifacts: `artifacts/tuning/*/report.json` | Expand search spaces and add acceptance thresholds |
| M5 Productization (Web SaaS) | TODO | Hosted workflow, queue workers, storage and dashboard | Commands: CI + production deployment checks (future)<br>Artifacts: versioned project outputs | Build minimal web product + worker queue + audit controls |

## Checklist

- [x] M1: Engine contract + no-dead-end/determinism/resource-bound gates
- [x] M2: IR schema/checker/compiler + integration tests
- [ ] M3: Rulebook workflow operational hardening and packaging
- [ ] M4: Tuning and restricted patch engine automation (in progress via `tune:smoke`)
- [ ] M5: SaaS productization and operations
