# Simulation

Baseline deterministic simulation and bot matches are available through CLI scripts.

## Commands

- `npm run sim:tictactoe`
- `npm run sim:splendor`

Optional positional args used by `scripts/simulate.ts`:

1. `gameId`
2. `seed`
3. `matches`
4. `maxTurns`

## Output

Each run prints:

- game id / match count / seed
- win rates
- average turns
- action distribution
- replay file path

Replay JSON files are written to:

- `artifacts/replays/`
