import { describe, expect, it } from "vitest";
import { LcgRng } from "../engine/invariantGate.js";
import { gameModules, gameRegistry } from "./index.js";

describe("game registry", () => {
  it("contains registered game modules", () => {
    expect(gameRegistry.tictactoe).toBeDefined();
    expect(gameRegistry.splendor).toBeDefined();
    expect(gameModules.map((module) => module.id)).toEqual(expect.arrayContaining(["tictactoe", "splendor"]));
  });

  it("exposes contract functions and supports a smoke transition", () => {
    for (const module of gameModules) {
      expect(typeof module.id).toBe("string");
      expect(typeof module.name).toBe("string");
      expect(typeof module.createInitialState).toBe("function");
      expect(typeof module.legalActions).toBe("function");
      expect(typeof module.applyAction).toBe("function");
      expect(typeof module.isTerminal).toBe("function");
      expect(typeof module.score).toBe("function");

      const seed = `registry-${module.id}`;
      const state = module.createInitialState(seed);
      expect(state).toBeDefined();

      if (!module.isTerminal(state)) {
        const actions = module.legalActions(state);
        expect(actions.length).toBeGreaterThan(0);
        const step = module.applyAction(state, actions[0], new LcgRng(seed));
        expect(step.state).toBeDefined();
      }
    }
  });
});
