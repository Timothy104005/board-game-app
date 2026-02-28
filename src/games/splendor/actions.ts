import type { Action, PlayerId } from "../../engine/contracts.js";
import type { NonGoldTokenColor, TokenColor } from "./state.js";

export interface TakeTokensPayload {
  take: NonGoldTokenColor[];
  discard?: TokenColor[];
}

export interface BuyCardPayload {
  cardId: string;
}

export type TakeTokensAction = Action<"take_tokens", TakeTokensPayload>;
export type BuyCardAction = Action<"buy_card", BuyCardPayload>;
export type SplendorAction = TakeTokensAction | BuyCardAction;

export function createTakeTokensAction(
  actor: PlayerId,
  take: readonly NonGoldTokenColor[],
  discard: readonly TokenColor[] = []
): TakeTokensAction {
  return {
    type: "take_tokens",
    actor,
    payload: {
      take: [...take],
      discard: [...discard]
    }
  };
}

export function createTakeThreeDistinctAction(
  actor: PlayerId,
  colors: readonly [NonGoldTokenColor, NonGoldTokenColor, NonGoldTokenColor],
  discard: readonly TokenColor[] = []
): TakeTokensAction {
  return createTakeTokensAction(actor, colors, discard);
}

export function createTakeTwoSameAction(
  actor: PlayerId,
  color: NonGoldTokenColor,
  discard: readonly TokenColor[] = []
): TakeTokensAction {
  return createTakeTokensAction(actor, [color, color], discard);
}

export function createBuyCardAction(actor: PlayerId, cardId: string): BuyCardAction {
  return {
    type: "buy_card",
    actor,
    payload: { cardId }
  };
}
