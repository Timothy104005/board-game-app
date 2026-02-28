import type { Action, PlayerId, RNG, State } from "../engine/contracts.js";
import type { GameModule } from "../games/types.js";

export interface BotContext<S extends State = State, A extends Action = Action> {
  game: GameModule<S, A>;
  state: S;
  legalActions: A[];
  playerId: PlayerId;
  rng: RNG;
}

export interface Bot<S extends State = State, A extends Action = Action> {
  id: string;
  chooseAction(ctx: BotContext<S, A>): A;
  explain?(ctx: BotContext<S, A>, action: A): string;
}
