# Rulebook Compiler Sandbox

Deterministic board-game tooling: `rulebook text -> IR draft -> compile -> simulate`.
The repo includes invariant gates, seeded bots, replay artifacts, patch templates, and golden regressions.
Use it to validate rules, compare balance, and prepare game specs for collaboration.

## Quickstart

```bash
npm install
npm test
npm run sim:tictactoe
```

## Key Commands

- `npm test -- --coverage`
- `npm run sim:tictactoe`
- `npm run sim:splendor`
- `npm run rb:run:tictactoe`
- `npm run rb:run:splendor`
- `npm run rb:run:connect4`
- `npm run rb:run:nim`
- `npm run rb:run:pig`

## Artifact Output Paths

- `artifacts/replays/`
- `artifacts/rulebook_run/`
- `artifacts/soak/`
