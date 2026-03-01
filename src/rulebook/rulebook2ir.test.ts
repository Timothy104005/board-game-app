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
import { checkIR } from "../ir/checker.js";
import { compileToGameModule, type CompiledAction, type CompiledState } from "../ir/compileToGameModule.js";
import { gameIRv0Schema } from "../ir/schema.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";
import type { GapItem } from "./types.js";

function loadRulebook(name: string): string {
  const fullPath = resolve(process.cwd(), "src", "rulebook", "examples", name);
  return readFileSync(fullPath, "utf8");
}

describe("rulebook -> IR draft", () => {
  it("recognizes tictactoe and compiles with invariant checks", () => {
    const text = loadRulebook("tictactoe.rulebook.txt");
    const drafted = draftIRFromRulebookText(text, { seedId: "ttt" });

    expect(() => JSON.stringify(drafted.irDraft)).not.toThrow();
    const parsed = gameIRv0Schema.parse(drafted.irDraft);
    const checker = checkIR(parsed);
    expect(checker.errors).toEqual([]);

    const module = compileToGameModule(parsed);
    const engine: EngineForInvariants<CompiledState, CompiledAction> = {
      legalActions: module.legalActions,
      applyAction: module.applyAction,
      isTerminal: module.isTerminal,
      score: module.score
    };

    assertNoDeadEnd(engine, module.createInitialState, { seed: "rb-ttt-nodeadend", maxDepth: 3 });
    assertDeterminism(
      engine,
      module.createInitialState,
      [
        { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 0 } },
        { type: "tictactoe_place", actor: "1", payload: { x: 1, y: 0 } },
        { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 1 } }
      ],
      "rb-ttt-determinism"
    );
  });

  it("recognizes mini-splendor and compiles with invariants + bounds", () => {
    const text = loadRulebook("mini_splendor.rulebook.txt");
    const drafted = draftIRFromRulebookText(text, { seedId: "splendor" });

    expect(() => JSON.stringify(drafted.irDraft)).not.toThrow();
    const parsed = gameIRv0Schema.parse(drafted.irDraft);
    const checker = checkIR(parsed);
    expect(checker.errors).toEqual([]);

    const module = compileToGameModule(parsed);
    const engine: EngineForInvariants<CompiledState, CompiledAction> = {
      legalActions: module.legalActions,
      applyAction: module.applyAction,
      isTerminal: module.isTerminal,
      score: module.score
    };

    assertNoDeadEnd(engine, module.createInitialState, { seed: "rb-splendor-nodeadend", maxDepth: 2 });
    assertDeterminism(
      engine,
      module.createInitialState,
      [
        { type: "take_tokens", actor: "0", payload: { colors: ["blue", "green", "red"] } },
        { type: "take_tokens", actor: "1", payload: { colors: ["white", "green", "black"] } },
        { type: "buy_card", actor: "0", payload: { cardId: "c1" } },
        { type: "take_tokens", actor: "1", payload: { colors: ["white", "red", "black"] } }
      ],
      "rb-splendor-determinism"
    );

    const bounds: ResourceBoundRule[] = parsed.invariants?.resourceBounds ?? [];
    const trajectory = runDeterministicTrajectory(module, "rb-splendor-bounds", 8);
    for (const state of trajectory) {
      assertResourceBounds(engine, state, { rules: bounds });
    }
  });

  it("falls back for unknown rulebook with checker/gap errors and serializable draft", () => {
    const text = loadRulebook("unknown.rulebook.txt");
    const drafted = draftIRFromRulebookText(text, { seedId: "unknown" });

    expect(() => JSON.stringify(drafted.irDraft)).not.toThrow();

    const checker = checkIR(drafted.irDraft);
    const errorGapCount = drafted.gaps.filter((gap) => gap.severity === "error").length;
    expect(checker.errors.length > 0 || errorGapCount >= 3).toBe(true);
    expect(drafted.gaps.length).toBeGreaterThan(0);
    expect(drafted.gaps).toEqual(sortedGaps(drafted.gaps));
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
    state = module.applyAction(state, legal[0], rng).state;
    trajectory.push(state);
  }

  return trajectory;
}

function sortedGaps(gaps: GapItem[]): GapItem[] {
  return [...gaps].sort((a, b) => {
    const aRank = a.severity === "error" ? 0 : 1;
    const bRank = b.severity === "error" ? 0 : 1;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    const pointerCmp = a.filePointer.localeCompare(b.filePointer);
    if (pointerCmp !== 0) {
      return pointerCmp;
    }
    return a.message.localeCompare(b.message);
  });
}
