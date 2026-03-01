import { createGreedyBot } from "../bots/greedyBot.ts";
import { createRandomBot } from "../bots/randomBot.ts";
import type { Bot } from "../bots/types.ts";
import type { GameIRv0 } from "../ir/types.ts";

export type BotsMode = "auto" | "greedy_vs_random" | "random_vs_random";

export function resolveBotsForIR(ir: GameIRv0, mode: BotsMode): { "0": Bot; "1": Bot } {
  if (mode === "greedy_vs_random") {
    return {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };
  }
  if (mode === "random_vs_random") {
    return {
      "0": createRandomBot("random0"),
      "1": createRandomBot("random1")
    };
  }

  const actionKinds = ir.actions.map((action) => action.kind);
  const useGreedy = actionKinds.some(
    (kind) => kind === "tictactoe_place" || kind === "take_tokens" || kind === "buy_card"
  );

  if (useGreedy) {
    return {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };
  }
  return {
    "0": createRandomBot("random0"),
    "1": createRandomBot("random1")
  };
}
