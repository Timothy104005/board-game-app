import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LcgRng,
  assertDeterminism,
  assertNoDeadEnd,
  assertResourceBounds,
  type EngineForInvariants,
  type ResourceBoundRule
} from "../engine/invariantGate.js";
import { compileToGameModule, type CompiledAction, type CompiledState } from "./compileToGameModule.js";
import { gameIRv0Schema } from "./schema.js";
import type { GameIRv0 } from "./types.js";

function loadFixture(name: string): GameIRv0 {
  const fullPath = resolve(process.cwd(), "src", "ir", "examples", name);
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fullPath, "utf8")));
}

describe("IR compiler integration", () => {
  it("compiles tictactoe IR and passes invariants", () => {
    const ir = loadFixture("tictactoe.ir.json");
    const module = compileToGameModule(ir);

    const engine: EngineForInvariants<CompiledState, CompiledAction> = {
      legalActions: module.legalActions,
      applyAction: module.applyAction,
      isTerminal: module.isTerminal,
      score: module.score
    };

    assertNoDeadEnd(engine, module.createInitialState, { seed: "ir-ttt-nodeadend", maxDepth: 6 });
    assertDeterminism(
      engine,
      module.createInitialState,
      [
        { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 0 } },
        { type: "tictactoe_place", actor: "1", payload: { x: 1, y: 0 } },
        { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 1 } },
        { type: "tictactoe_place", actor: "1", payload: { x: 1, y: 1 } },
        { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 2 } }
      ],
      "ir-ttt-seed"
    );
  });

  it("compiles mini splendor IR and passes invariants + bounds", () => {
    const ir = loadFixture("mini_splendor.ir.json");
    const module = compileToGameModule(ir);

    const engine: EngineForInvariants<CompiledState, CompiledAction> = {
      legalActions: module.legalActions,
      applyAction: module.applyAction,
      isTerminal: module.isTerminal,
      score: module.score
    };

    assertNoDeadEnd(engine, module.createInitialState, { seed: "ir-splendor-nodeadend", maxDepth: 4 });

    const sequence: CompiledAction[] = [
      { type: "take_tokens", actor: "0", payload: { colors: ["blue", "green", "red"] } },
      { type: "take_tokens", actor: "1", payload: { colors: ["white", "green", "black"] } },
      { type: "buy_card", actor: "0", payload: { cardId: "c1" } },
      { type: "take_tokens", actor: "1", payload: { colors: ["white", "red", "black"] } },
      { type: "take_tokens", actor: "0", payload: { colors: ["white", "blue", "red"] } },
      { type: "buy_card", actor: "1", payload: { cardId: "c2" } },
      { type: "buy_card", actor: "0", payload: { cardId: "c3" } }
    ];
    assertDeterminism(engine, module.createInitialState, sequence, "ir-splendor-seed");

    const bounds: ResourceBoundRule[] = ir.invariants?.resourceBounds ?? [];
    const trajectory = runDeterministicTrajectory(module, "ir-splendor-bounds", 20);
    for (const state of trajectory) {
      assertResourceBounds(engine, state, { rules: bounds });
      for (const player of Object.values(state.players)) {
        const tokenTotal = Object.values(player.tokens).reduce((sum, count) => sum + count, 0);
        expect(tokenTotal).toBeLessThanOrEqual(10);
      }
    }
  });
});

function runDeterministicTrajectory(
  module: ReturnType<typeof compileToGameModule>,
  seed: string,
  maxSteps: number
): CompiledState[] {
  let state = module.createInitialState(seed);
  const rng = new LcgRng(seed);
  const trajectory: CompiledState[] = [state];

  for (let step = 0; step < maxSteps; step += 1) {
    if (module.isTerminal(state)) {
      return trajectory;
    }
    const legal = module.legalActions(state);
    if (legal.length === 0) {
      return trajectory;
    }
    const result = module.applyAction(state, legal[0], rng);
    state = result.state;
    trajectory.push(state);
  }

  return trajectory;
}
