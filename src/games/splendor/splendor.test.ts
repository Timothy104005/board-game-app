import { describe, expect, it } from "vitest";
import {
  LcgRng,
  assertDeterminism,
  assertNoDeadEnd,
  assertResourceBounds,
  type EngineForInvariants,
  type ResourceBoundRule
} from "../../engine/invariantGate.js";
import { createBuyCardAction, createTakeThreeDistinctAction, type SplendorAction } from "./actions.js";
import { applyAction, initialState, isTerminal, legalActions, score } from "./engine.js";
import { totalTokens, type SplendorState } from "./state.js";

const engine: EngineForInvariants<SplendorState, SplendorAction> = {
  legalActions,
  applyAction,
  isTerminal,
  score
};

describe("mini-splendor module", () => {
  it("buying a card reduces tokens, grants discount, and removes market card", () => {
    const state = initialState("splendor-buy");
    state.players[0].tokens.blue = 1;
    state.players[0].tokens.green = 1;
    state.players[0].tokens.red = 1;

    const beforeBlue = state.bank.blue;
    const beforeGreen = state.bank.green;
    const beforeRed = state.bank.red;

    const step = applyAction(state, createBuyCardAction("0", "c1"), new LcgRng("splendor-buy"));
    const actor = step.state.players[0];

    expect(actor.tokens.blue).toBe(0);
    expect(actor.tokens.green).toBe(0);
    expect(actor.tokens.red).toBe(0);
    expect(step.state.bank.blue).toBe(beforeBlue + 1);
    expect(step.state.bank.green).toBe(beforeGreen + 1);
    expect(step.state.bank.red).toBe(beforeRed + 1);
    expect(actor.discounts.white).toBe(1);
    expect(actor.purchasedCardIds).toContain("c1");
    expect(actor.points).toBe(0);
    expect(step.state.marketCardIds.includes("c1")).toBe(false);
  });

  it("discount applies to next purchase", () => {
    const rng = new LcgRng("splendor-discount");
    const state = initialState("splendor-discount");
    state.players[0].tokens.white = 1;
    state.players[0].tokens.blue = 2;
    state.players[0].tokens.green = 1;
    state.players[0].tokens.red = 2;

    const firstBuy = applyAction(state, createBuyCardAction("0", "c1"), rng);
    const p1Action = legalActions(firstBuy.state)[0];
    const afterP1 = applyAction(firstBuy.state, p1Action, rng);
    const secondBuy = applyAction(afterP1.state, createBuyCardAction("0", "c3"), rng);
    const actor = secondBuy.state.players[0];

    expect(actor.tokens.white).toBe(0);
    expect(actor.tokens.blue).toBe(0);
    expect(actor.tokens.red).toBe(0);
    expect(actor.discounts.white).toBe(1);
    expect(actor.discounts.green).toBe(1);
    expect(actor.points).toBe(1);
    expect(actor.purchasedCardIds).toEqual(["c1", "c3"]);
  });

  it("cannot buy unaffordable card and legalActions only lists affordable buys", () => {
    const state = initialState("splendor-unaffordable");
    const initialBuys = legalActions(state).filter((action) => action.type === "buy_card");
    expect(initialBuys.length).toBe(0);

    expect(() => applyAction(state, createBuyCardAction("0", "c6"), new LcgRng("splendor-unaffordable"))).toThrow(
      "Illegal action: buy_card"
    );
  });

  it("is deterministic under fixed seed and mixed action sequence", () => {
    const sequence: SplendorAction[] = [
      createTakeThreeDistinctAction("0", ["blue", "green", "red"]),
      createTakeThreeDistinctAction("1", ["white", "green", "black"]),
      createBuyCardAction("0", "c1"),
      createTakeThreeDistinctAction("1", ["white", "red", "black"]),
      createTakeThreeDistinctAction("0", ["white", "blue", "red"]),
      createBuyCardAction("1", "c2"),
      createBuyCardAction("0", "c3")
    ];

    assertDeterminism(engine, initialState, sequence, "splendor-fixed-seed-mixed");
  });

  it("invariant gate still passes (no dead-end)", () => {
    assertNoDeadEnd(engine, initialState, { seed: "splendor-no-dead-end", maxDepth: 4 });
  });

  it("enforces token limit with explicit discard options for take_tokens", () => {
    const state = initialState("splendor-discard");
    state.players[0].tokens.white = 4;
    state.players[0].tokens.blue = 2;
    state.players[0].tokens.green = 2;
    state.players[0].tokens.red = 1;
    state.players[0].tokens.black = 1;

    const actions = legalActions(state);
    const withDiscard = actions.find(
      (action) => action.type === "take_tokens" && (action.payload?.discard?.length ?? 0) > 0
    );
    expect(withDiscard).toBeDefined();

    if (!withDiscard) {
      throw new Error("Expected at least one take action with discard payload.");
    }

    const step = applyAction(state, withDiscard, new LcgRng("splendor-discard"));
    const actor = step.state.players.find((player) => player.id === "0");
    expect(actor).toBeDefined();
    if (!actor) {
      throw new Error("Missing actor after action.");
    }
    expect(totalTokens(actor.tokens)).toBeLessThanOrEqual(10);
  });

  it("keeps resource bounds for bank and player token totals", () => {
    const bounds: ResourceBoundRule[] = [
      { path: "bank.white", min: 0, max: 4 },
      { path: "bank.blue", min: 0, max: 4 },
      { path: "bank.green", min: 0, max: 4 },
      { path: "bank.red", min: 0, max: 4 },
      { path: "bank.black", min: 0, max: 4 },
      { path: "bank.gold", min: 0, max: 5 },
      { path: "players.*.totalTokens", min: 0, max: 10 }
    ];

    const trajectory = runDeterministicTrajectory("splendor-bounds", 20);
    for (const state of trajectory) {
      const view = {
        ...state,
        players: state.players.map((player) => ({
          ...player,
          totalTokens: totalTokens(player.tokens)
        }))
      };
      assertResourceBounds(engine, view, { rules: bounds });
    }
  });
});

function runDeterministicTrajectory(seed: string, maxSteps: number): SplendorState[] {
  let state = initialState(seed);
  const rng = new LcgRng(seed);
  const trajectory: SplendorState[] = [state];

  for (let step = 0; step < maxSteps; step += 1) {
    if (isTerminal(state)) {
      return trajectory;
    }

    const actions = legalActions(state);
    if (actions.length === 0) {
      return trajectory;
    }

    const next = applyAction(state, actions[0], rng).state;
    trajectory.push(next);
    state = next;
  }

  return trajectory;
}
