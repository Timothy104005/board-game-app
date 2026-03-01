import { gameIRv0Schema } from "./schema.js";
import type { GameIRv0 } from "./types.js";

const SUPPORTED_ACTION_KINDS = new Set([
  "tictactoe_place",
  "take_tokens",
  "buy_card",
  "connect4_drop",
  "take_from_pile",
  "pig_roll",
  "pig_hold"
]);

export interface IRCheckResult {
  errors: string[];
  warnings: string[];
}

export function checkIR(ir: unknown): IRCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = gameIRv0Schema.safeParse(ir);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      errors.push(`${path}: ${issue.message}`);
    }
    return { errors, warnings };
  }

  const valid = parsed.data;
  runConsistencyChecks(valid, errors, warnings);
  return { errors, warnings };
}

function runConsistencyChecks(ir: GameIRv0, errors: string[], warnings: string[]): void {
  if (ir.meta.playersMin > ir.meta.playersMax) {
    errors.push("meta.playersMin must be <= meta.playersMax.");
  }

  const playerIds = Object.keys(ir.state.players);
  if (playerIds.length < ir.meta.playersMin || playerIds.length > ir.meta.playersMax) {
    errors.push(
      `state.players count (${playerIds.length}) must be between meta.playersMin (${ir.meta.playersMin}) and meta.playersMax (${ir.meta.playersMax}).`
    );
  }

  for (const action of ir.actions) {
    if (!SUPPORTED_ACTION_KINDS.has(action.kind)) {
      errors.push(`Unsupported action kind: ${action.kind}`);
    }
  }

  if (ir.actions.some((action) => action.kind === "tictactoe_place")) {
    const board = ir.state.public.board;
    if (!Array.isArray(board) || board.length === 0) {
      errors.push("tictactoe_place requires state.public.board as a non-empty array.");
    }
  }

  if (ir.actions.some((action) => action.kind === "take_tokens")) {
    const bank = ir.state.public.bank;
    if (!bank || typeof bank !== "object") {
      errors.push("take_tokens requires state.public.bank object.");
    }
  }

  if (ir.actions.some((action) => action.kind === "buy_card")) {
    const market = ir.state.public.marketCardIds;
    const cardPool = ir.state.public.cardPool;
    if (!Array.isArray(market)) {
      errors.push("buy_card requires state.public.marketCardIds array.");
    }
    if (!Array.isArray(cardPool)) {
      errors.push("buy_card requires state.public.cardPool array.");
    }
  }

  if (ir.actions.some((action) => action.kind === "connect4_drop")) {
    const board = ir.state.public.board;
    if (!isGrid(board, 6, 7)) {
      errors.push("connect4_drop requires state.public.board as a 6x7 array.");
    }
  }

  if (ir.actions.some((action) => action.kind === "take_from_pile")) {
    const piles = ir.state.public.piles;
    if (!Array.isArray(piles) || piles.length === 0 || !piles.every((entry) => typeof entry === "number")) {
      errors.push("take_from_pile requires state.public.piles numeric array.");
    }

    for (const action of ir.actions) {
      if (action.kind !== "take_from_pile") {
        continue;
      }
      if (action.params.minTake < 1) {
        errors.push("take_from_pile requires minTake >= 1.");
      }
      if (action.params.maxTake < action.params.minTake) {
        errors.push("take_from_pile requires maxTake >= minTake.");
      }
    }
  }

  const hasPigRoll = ir.actions.some((action) => action.kind === "pig_roll");
  const hasPigHold = ir.actions.some((action) => action.kind === "pig_hold");
  if (hasPigRoll || hasPigHold) {
    if (!hasPigRoll || !hasPigHold) {
      errors.push("pig game requires both pig_roll and pig_hold actions.");
    }
    if (typeof ir.state.public.turnTotal !== "number") {
      errors.push("pig actions require state.public.turnTotal numeric value.");
    }
    if (ir.end.kind !== "score_at_least" && ir.end.kind !== "turn_limit") {
      errors.push("pig actions require end.kind to be score_at_least or turn_limit.");
    }
  }

  if (ir.end.kind === "never") {
    warnings.push("end.kind is 'never'; game may rely on legal-action exhaustion to terminate.");
  }
}

function isGrid(value: unknown, expectedRows: number, expectedCols: number): boolean {
  if (!Array.isArray(value) || value.length !== expectedRows) {
    return false;
  }
  return value.every((row) => Array.isArray(row) && row.length === expectedCols);
}
