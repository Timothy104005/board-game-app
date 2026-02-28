import { describe, it } from "vitest";
import type { Action, Phase, PlayerId, RNG, Stage, StepResult } from "./contracts.js";
import {
  LcgRng,
  assertDeterminism,
  assertNoDeadEnd,
  assertResourceBounds,
  type EngineForInvariants,
  type ResourceBoundRule
} from "./invariantGate.js";

type FixtureActionType = "pass" | "gain_random_energy" | "spend_energy_for_point";
type FixtureAction = Action<FixtureActionType>;

interface FixturePlayer {
  id: PlayerId;
  energy: number;
  points: number;
}

interface FixtureState {
  seed: string;
  turn: number;
  phase: Phase;
  stage: Stage;
  currentPlayer: PlayerId;
  players: FixturePlayer[];
}

const MAX_TURNS = 8;
const MAX_ENERGY = 10;
const WIN_POINTS = 5;

function initialState(seed: string): FixtureState {
  return {
    seed,
    turn: 0,
    phase: "main",
    stage: "action",
    currentPlayer: "0",
    players: [
      { id: "0", energy: 2, points: 0 },
      { id: "1", energy: 2, points: 0 }
    ]
  };
}

function legalActions(state: FixtureState): FixtureAction[] {
  if (isTerminal(state)) {
    return [];
  }

  const current = getPlayer(state, state.currentPlayer);
  const actions: FixtureAction[] = [
    { type: "pass", actor: state.currentPlayer },
    { type: "gain_random_energy", actor: state.currentPlayer }
  ];

  if (current.energy > 0) {
    actions.push({ type: "spend_energy_for_point", actor: state.currentPlayer });
  }

  return actions;
}

function applyAction(
  state: FixtureState,
  action: FixtureAction,
  rng: RNG
): StepResult<FixtureState, FixtureAction> {
  if (isTerminal(state)) {
    throw new Error("Cannot apply action to terminal state.");
  }
  if (action.actor !== state.currentPlayer) {
    throw new Error("Only the current player may act.");
  }

  const available = legalActions(state);
  const isLegal = available.some((candidate) => candidate.type === action.type);
  if (!isLegal) {
    throw new Error(`Illegal action: ${action.type}`);
  }

  const stateHashBefore = stableHash(state);
  const next = cloneState(state);
  const actor = getPlayer(next, action.actor);

  switch (action.type) {
    case "pass":
      break;
    case "gain_random_energy": {
      const gain = rng.nextInt(0, 2);
      actor.energy = Math.min(MAX_ENERGY, actor.energy + gain);
      break;
    }
    case "spend_energy_for_point":
      if (actor.energy <= 0) {
        throw new Error("Cannot spend energy below zero.");
      }
      actor.energy -= 1;
      actor.points += 1;
      break;
    default:
      exhaustiveCheck(action.type);
  }

  advanceTurn(next);

  const terminal = isTerminal(next);
  const stateHashAfter = stableHash(next);

  return {
    state: next,
    terminal,
    scores: terminal ? score(next) : undefined,
    replayEvent: {
      index: state.turn,
      seed: rng.seed,
      turn: next.turn,
      phase: next.phase,
      actor: action.actor,
      action,
      stateHashBefore,
      stateHashAfter,
      stage: next.stage
    }
  };
}

function isTerminal(state: FixtureState): boolean {
  return state.turn >= MAX_TURNS || state.phase === "end" || state.players.some((p) => p.points >= WIN_POINTS);
}

function score(state: FixtureState): Record<PlayerId, number> {
  return Object.fromEntries(state.players.map((player) => [player.id, player.points])) as Record<PlayerId, number>;
}

function getPlayer(state: FixtureState, playerId: PlayerId): FixturePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Missing player: ${playerId}`);
  }
  return player;
}

function advanceTurn(state: FixtureState): void {
  state.turn += 1;

  if (state.players.length !== 2) {
    throw new Error("Fixture assumes exactly two players.");
  }

  state.currentPlayer = state.currentPlayer === state.players[0].id ? state.players[1].id : state.players[0].id;

  const reachedWin = state.players.some((player) => player.points >= WIN_POINTS);
  if (state.turn >= MAX_TURNS || reachedWin) {
    state.phase = "end";
    state.stage = null;
    return;
  }

  state.phase = "main";
  state.stage = "action";
}

function cloneState(state: FixtureState): FixtureState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player }))
  };
}

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return '"__undefined__"';
  }
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",");
  return `{${body}}`;
}

function runToTerminal(seed: string, maxSteps = 64): FixtureState[] {
  let state = initialState(seed);
  const rng = new LcgRng(seed);
  const trajectory: FixtureState[] = [state];

  for (let steps = 0; steps < maxSteps; steps += 1) {
    if (isTerminal(state)) {
      return trajectory;
    }

    const actions = legalActions(state);
    const action =
      actions.find((candidate) => candidate.type === "spend_energy_for_point") ??
      actions.find((candidate) => candidate.type === "gain_random_energy") ??
      actions[0];
    const step = applyAction(state, action, rng);
    state = step.state;
    trajectory.push(state);
  }

  throw new Error(`runToTerminal exceeded ${maxSteps} steps.`);
}

function exhaustiveCheck(unreachable: never): never {
  throw new Error(`Unhandled action variant: ${String(unreachable)}`);
}

const fixtureEngine: EngineForInvariants<FixtureState, FixtureAction> = {
  legalActions,
  applyAction,
  isTerminal,
  score
};

describe("engine invariants", () => {
  it("no-dead-end on reachable non-terminal states", () => {
    assertNoDeadEnd(fixtureEngine, initialState, { seed: "scope-v1-reachable", maxDepth: MAX_TURNS });
  });

  it("determinism under fixed seed", () => {
    const sequence: FixtureAction[] = [
      { type: "gain_random_energy", actor: "0" },
      { type: "spend_energy_for_point", actor: "1" },
      { type: "pass", actor: "0" },
      { type: "gain_random_energy", actor: "1" },
      { type: "spend_energy_for_point", actor: "0" },
      { type: "pass", actor: "1" },
      { type: "gain_random_energy", actor: "0" },
      { type: "spend_energy_for_point", actor: "1" }
    ];

    assertDeterminism(fixtureEngine, initialState, sequence, "scope-v1-fixed-seed");
  });

  it("generic resource bound checks (config-driven)", () => {
    const bounds: ResourceBoundRule[] = [
      { path: "turn", min: 0, max: MAX_TURNS },
      { path: "players.*.energy", min: 0, max: MAX_ENERGY },
      { path: "players.*.points", min: 0, max: WIN_POINTS }
    ];

    const trajectory = runToTerminal("scope-v1-bounds");
    for (const state of trajectory) {
      assertResourceBounds(fixtureEngine, state, { rules: bounds });
    }
  });
});
