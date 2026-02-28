# IR v0 (GDL-lite)

This project includes a minimal, runtime-validated IR for compiling game rules into executable `GameModule` implementations.

## Top-level fields

- `meta`: identity and player bounds.
- `rng`: deterministic seedability (`seedable: true`).
- `state`: initial public state plus per-player state.
- `turn`: turn order and phases.
- `actions`: supported action specifications.
- `end`: end condition.
- `scoring`: score interpretation.
- `invariants` (optional): resource bounds used by invariant tests.

## Supported action kinds

- `tictactoe_place`
  - payload params: `{ x, y }`
  - effect: place mark, detect win/draw
- `take_tokens`
  - payload params: `{ colors: string[] }`
  - supported forms: 3 distinct or 2 same (`supply >= 4`)
- `buy_card`
  - payload params: `{ cardId }`
  - effect: pay `tokens - discounts`, gain `points`, gain bonus discount

## Examples

- `src/ir/examples/tictactoe.ir.json`
- `src/ir/examples/mini_splendor.ir.json`

## Validation

- `src/ir/schema.ts` defines Zod schema.
- `src/ir/checker.ts` adds consistency checks and actionable errors/warnings.
