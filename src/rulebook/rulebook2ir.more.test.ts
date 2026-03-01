import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LcgRng,
  assertDeterminism,
  assertNoDeadEnd,
  type EngineForInvariants
} from "../engine/invariantGate.js";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule, type CompiledAction, type CompiledState } from "../ir/compileToGameModule.js";
import { gameIRv0Schema } from "../ir/schema.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";

function loadRulebook(name: string): string {
  return readFileSync(resolve(process.cwd(), "src", "rulebook", "examples", name), "utf8");
}

describe("rulebook -> IR recognizers (connect4/nim/pig)", () => {
  it("connect4 rulebook compiles and passes bounded invariants", () => {
    const drafted = draftIRFromRulebookText(loadRulebook("connect4.rulebook.txt"), { seedId: "c4" });
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

    assertNoDeadEnd(engine, module.createInitialState, { seed: "c4-nodeadend", maxDepth: 3 });
    assertDeterminism(
      engine,
      module.createInitialState,
      [
        { type: "connect4_drop", actor: "0", payload: { column: 0 } },
        { type: "connect4_drop", actor: "1", payload: { column: 1 } },
        { type: "connect4_drop", actor: "0", payload: { column: 0 } },
        { type: "connect4_drop", actor: "1", payload: { column: 1 } },
        { type: "connect4_drop", actor: "0", payload: { column: 0 } }
      ],
      "c4-determinism"
    );
  });

  it("nim rulebook compiles and passes bounded invariants", () => {
    const drafted = draftIRFromRulebookText(loadRulebook("nim.rulebook.txt"), { seedId: "nim" });
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

    assertNoDeadEnd(engine, module.createInitialState, { seed: "nim-nodeadend", maxDepth: 4 });
    assertDeterminism(
      engine,
      module.createInitialState,
      [
        { type: "take_from_pile", actor: "0", payload: { pileIndex: 0, count: 3 } },
        { type: "take_from_pile", actor: "1", payload: { pileIndex: 1, count: 3 } },
        { type: "take_from_pile", actor: "0", payload: { pileIndex: 1, count: 1 } },
        { type: "take_from_pile", actor: "1", payload: { pileIndex: 2, count: 3 } },
        { type: "take_from_pile", actor: "0", payload: { pileIndex: 2, count: 2 } }
      ],
      "nim-determinism"
    );
  });

  it("pig rulebook compiles and is deterministic under seed", () => {
    const drafted = draftIRFromRulebookText(loadRulebook("pig.rulebook.txt"), { seedId: "pig" });
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

    assertNoDeadEnd(engine, module.createInitialState, { seed: "pig-nodeadend", maxDepth: 3 });
    const sequence = deriveDeterministicSequence(module, "pig-seq", 8);
    assertDeterminism(engine, module.createInitialState, sequence, "pig-seq");
  });
});

function deriveDeterministicSequence(
  module: ReturnType<typeof compileToGameModule>,
  seed: string,
  steps: number
): CompiledAction[] {
  const actions: CompiledAction[] = [];
  const rng = new LcgRng(seed);
  let state = module.createInitialState(seed);

  for (let i = 0; i < steps; i += 1) {
    if (module.isTerminal(state)) {
      break;
    }
    const legal = module.legalActions(state);
    if (legal.length === 0) {
      break;
    }
    const selected = legal.find((action) => action.type === "pig_roll") ?? legal[0];
    actions.push(selected);
    state = module.applyAction(state, selected, rng).state;
  }

  return actions;
}
