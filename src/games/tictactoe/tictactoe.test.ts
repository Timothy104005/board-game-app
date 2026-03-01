import { describe, expect, it } from "vitest";
import {
  LcgRng,
  assertDeterminism,
  assertNoDeadEnd,
  type EngineForInvariants
} from "../../engine/invariantGate.js";
import { createPlaceMarkAction, type TicTacToeAction } from "./actions.js";
import { applyAction, initialState, isTerminal, legalActions, score } from "./engine.js";
import type { TicTacToeState } from "./state.js";

const engine: EngineForInvariants<TicTacToeState, TicTacToeAction> = {
  legalActions,
  applyAction,
  isTerminal,
  score
};

describe("tictactoe module", () => {
  it(
    "has no dead-end on reachable non-terminal states",
    () => {
      assertNoDeadEnd(engine, initialState, { seed: "ttt-nodeadend", maxDepth: 4 });
    },
    15000
  );

  it("is deterministic under fixed seed and action sequence", () => {
    const sequence: TicTacToeAction[] = [
      createPlaceMarkAction("0", 0),
      createPlaceMarkAction("1", 3),
      createPlaceMarkAction("0", 1),
      createPlaceMarkAction("1", 4),
      createPlaceMarkAction("0", 2)
    ];

    assertDeterminism(engine, initialState, sequence, "ttt-fixed-seed");
  });

  it("detects a winner correctly", () => {
    let state = initialState("ttt-win");
    const rng = new LcgRng("ttt-win");

    const sequence: TicTacToeAction[] = [
      createPlaceMarkAction("0", 0),
      createPlaceMarkAction("1", 3),
      createPlaceMarkAction("0", 1),
      createPlaceMarkAction("1", 4),
      createPlaceMarkAction("0", 2)
    ];

    for (const action of sequence) {
      state = applyAction(state, action, rng).state;
    }

    expect(isTerminal(state)).toBe(true);
    expect(state.winner).toBe("0");
    expect(score(state)).toEqual({ "0": 1, "1": 0 });
  });

  it("detects a draw correctly", () => {
    let state = initialState("ttt-draw");
    const rng = new LcgRng("ttt-draw");

    const sequence: TicTacToeAction[] = [
      createPlaceMarkAction("0", 0),
      createPlaceMarkAction("1", 1),
      createPlaceMarkAction("0", 2),
      createPlaceMarkAction("1", 4),
      createPlaceMarkAction("0", 3),
      createPlaceMarkAction("1", 5),
      createPlaceMarkAction("0", 7),
      createPlaceMarkAction("1", 6),
      createPlaceMarkAction("0", 8)
    ];

    for (const action of sequence) {
      state = applyAction(state, action, rng).state;
    }

    expect(isTerminal(state)).toBe(true);
    expect(state.winner).toBeNull();
    expect(score(state)).toEqual({ "0": 0, "1": 0 });
  });
});
