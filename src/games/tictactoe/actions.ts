import type { Action, PlayerId } from "../../engine/contracts.js";

export interface PlaceMarkPayload {
  index: number;
}

export type PlaceMarkAction = Action<"place_mark", PlaceMarkPayload>;
export type TicTacToeAction = PlaceMarkAction;

export function createPlaceMarkAction(actor: PlayerId, index: number): PlaceMarkAction {
  return {
    type: "place_mark",
    actor,
    payload: { index }
  };
}
