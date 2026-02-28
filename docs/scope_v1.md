# Scope V1: Rulebook-to-Simulator

This v1 scope gate follows a boardgame.io-style mental model (turn-taking plus phase/stage), while keeping the engine contract framework-agnostic and UI-free.

## In-Scope
- Deterministic turn progression and state transitions.
- Phase and stage representation in state/replay metadata.
- Pure engine contract functions for state lifecycle and action stepping.
- Replay event emission per state transition.
- Invariant tests that run headless (no UI dependency).
- Deterministic RNG behavior through explicit injected RNG.

## Out-of-Scope
- UI rendering, interaction components, or client-side views.
- Networking, transport, matchmaking, or multiplayer sync protocols.
- AI strategy quality, bots, or search/planning strength.
- Persistence backends (database/event store) and production telemetry.
- Performance tuning/optimization beyond baseline correctness.
- Rulebook NLP extraction/parsing from natural language text.

## Engine Contract
Required signatures:

```ts
initialState(seed: string): State
legalActions(state: State): Action[]
applyAction(state: State, action: Action, rng: RNG): StepResult
isTerminal(state: State): boolean
score(state: State): Record<PlayerId, number>
```

Contract expectations:
- `initialState` is deterministic for a given `seed`.
- `legalActions` returns legal choices for the current state only.
- `applyAction` applies exactly one action and returns the next state plus replay metadata.
- `isTerminal` indicates whether the game has ended.
- `score` returns deterministic player scores for any state (terminal and non-terminal allowed, terminal required).

## RNG Determinism Requirements
- All randomness must flow through the injected `RNG` interface.
- `Math.random` and other ambient randomness are prohibited in engine logic.
- Same `seed` + same initial state + same action sequence must produce identical:
  - state trajectory,
  - replay events,
  - terminal scores.
- RNG must support `clone()` to preserve deterministic branching/replay scenarios.

## Definition of Done
V1 is done when all of the following are true:

- Invariant: Every reachable non-terminal state has at least one legal action.
- Invariant: Re-running with fixed seed and fixed action sequence yields identical results.
- Invariant: Config-driven numeric resource bounds stay within declared min/max.
- Engine contracts are typed and exported (`State`, `Action`, `RNG`, `StepResult`, `ReplayEvent`).
- Invariant tests run without UI and pass in Node test environment.

Replay log minimum required fields per event:
- `index`
- `seed`
- `turn`
- `phase`
- `actor`
- `action`
- `stateHashBefore`
- `stateHashAfter`
- Optional: `stage`
