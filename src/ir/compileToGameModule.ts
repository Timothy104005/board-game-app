import type { Action, PlayerId, RNG, StepResult } from "../engine/contracts.js";
import { checkIR } from "./checker.js";
import { gameIRv0Schema } from "./schema.js";
import type { GameIRv0 } from "./types.js";
import type { GameModule } from "../games/types.js";

type CompiledActionKind = "tictactoe_place" | "take_tokens" | "buy_card";

interface CompiledActionPayload {
  x?: number;
  y?: number;
  colors?: string[];
  cardId?: string;
  diff?: Record<string, unknown>;
}

export type CompiledAction = Action<CompiledActionKind, CompiledActionPayload>;

interface CompiledCard {
  id: string;
  cost: Record<string, number>;
  points: number;
  bonusColor: string;
}

interface CompiledPlayerState {
  id: string;
  points: number;
  mark?: string;
  tokens: Record<string, number>;
  discounts: Record<string, number>;
  purchasedCardIds: string[];
}

export interface CompiledState {
  seed: string;
  turn: number;
  phase: string;
  stage: string | null;
  currentPlayer: string;
  playerOrder: string[];
  maxTurns: number | null;
  public: Record<string, unknown>;
  players: Record<string, CompiledPlayerState>;
}

const NON_GOLD_COLORS = ["white", "blue", "green", "red", "black"] as const;

export function compileToGameModule(irInput: unknown): GameModule<CompiledState, CompiledAction> {
  const parseResult = gameIRv0Schema.safeParse(irInput);
  if (!parseResult.success) {
    throw new Error(`Invalid IR: ${parseResult.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const checks = checkIR(parseResult.data);
  if (checks.errors.length > 0) {
    throw new Error(`IR check failed: ${checks.errors.join(" | ")}`);
  }

  const ir = parseResult.data;
  const supportedActionKinds = new Set(ir.actions.map((action) => action.kind));
  const takeColors = extractTakeColors(ir);

  const generateLegalActions = (state: CompiledState): CompiledAction[] => {
    const actions: CompiledAction[] = [];
    const actor = state.players[state.currentPlayer];
    if (!actor) {
      return actions;
    }

    if (supportedActionKinds.has("tictactoe_place")) {
      actions.push(...enumerateTicTacToeActions(state));
    }
    if (supportedActionKinds.has("take_tokens")) {
      actions.push(...enumerateTakeTokenActions(state, actor, takeColors));
    }
    if (supportedActionKinds.has("buy_card")) {
      actions.push(...enumerateBuyCardActions(state, actor));
    }
    return actions;
  };

  const isTerminalState = (state: CompiledState): boolean => {
    if (state.phase === "end") {
      return true;
    }

    if (ir.end.kind === "turn_limit" && state.turn >= ir.end.maxTurns) {
      return true;
    }
    if (ir.end.kind === "score_at_least") {
      const playerIds = Object.keys(state.players);
      if (playerIds.some((playerId) => state.players[playerId].points >= ir.end.target)) {
        return true;
      }
    }

    if (supportedActionKinds.has("tictactoe_place")) {
      const board = getBoard(state);
      if (board && (getWinnerId(state, board) !== null || isBoardFull(board))) {
        return true;
      }
    }

    return generateLegalActions(state).length === 0;
  };

  const module: GameModule<CompiledState, CompiledAction> = {
    id: ir.meta.id,
    name: ir.meta.name,
    createInitialState: (seed: string) => createInitialStateFromIR(ir, seed),
    legalActions: (state: CompiledState) => {
      if (isTerminalState(state)) {
        return [];
      }
      return generateLegalActions(state);
    },
    applyAction: (state: CompiledState, action: CompiledAction, rng: RNG) => {
      if (isTerminalState(state)) {
        throw new Error("Cannot apply action to terminal state.");
      }
      if (action.actor !== state.currentPlayer) {
        throw new Error("Only the current player may act.");
      }

      const legal = generateLegalActions(state);
      if (!legal.some((candidate) => canonicalAction(candidate) === canonicalAction(action))) {
        throw new Error(`Illegal action: ${action.type}`);
      }

      const stateHashBefore = stableHash(state);
      const next = deepClone(state);
      const actor = next.players[action.actor];
      let diff: Record<string, unknown> = {};

      switch (action.type) {
        case "tictactoe_place":
          diff = applyTicTacToePlace(next, actor, action);
          break;
        case "take_tokens":
          diff = applyTakeTokens(next, actor, action);
          break;
        case "buy_card":
          diff = applyBuyCard(next, actor, action);
          break;
        default:
          exhaustiveCheck(action);
      }

      if (totalPlayerTokens(actor) > getTokenLimit(next)) {
        throw new Error("Token limit exceeded after action.");
      }

      next.turn += 1;
      const terminal = isTerminalState(next);
      if (terminal) {
        next.phase = "end";
        next.stage = null;
      } else {
        next.currentPlayer = getNextPlayer(next);
        next.phase = ir.turn.phases[0];
        next.stage = "action";
      }

      const stateHashAfter = stableHash(next);
      return {
        state: next,
        terminal,
        scores: terminal ? module.score(next) : undefined,
        replayEvent: {
          index: state.turn,
          seed: rng.seed,
          turn: next.turn,
          phase: next.phase,
          actor: action.actor,
          action: withDiff(action, diff),
          stateHashBefore,
          stateHashAfter,
          stage: next.stage
        }
      } as StepResult<CompiledState, CompiledAction>;
    },
    isTerminal: (state: CompiledState) => isTerminalState(state),
    score: (state: CompiledState) => scoreState(state, ir, supportedActionKinds)
  };

  return module;
}

function createInitialStateFromIR(ir: GameIRv0, seed: string): CompiledState {
  const players = normalizePlayers(ir);
  const order = Object.keys(players);
  const publicState = deepClone(ir.state.public);

  return {
    seed,
    turn: Number(publicState.turn ?? 0),
    phase: String(publicState.phase ?? ir.turn.phases[0]),
    stage: (publicState.stage as string | null | undefined) ?? "action",
    currentPlayer: String(publicState.currentPlayer ?? order[0]),
    playerOrder: order,
    maxTurns: ir.end.kind === "turn_limit" ? ir.end.maxTurns : null,
    public: publicState,
    players
  };
}

function normalizePlayers(ir: GameIRv0): Record<string, CompiledPlayerState> {
  const out: Record<string, CompiledPlayerState> = {};
  for (const [id, raw] of Object.entries(ir.state.players)) {
    const candidate = raw as Record<string, unknown>;
    out[id] = {
      id,
      points: asNumber(candidate.points, 0),
      mark: typeof candidate.mark === "string" ? candidate.mark : undefined,
      tokens: normalizeNumberRecord(candidate.tokens),
      discounts: normalizeNumberRecord(candidate.discounts),
      purchasedCardIds: Array.isArray(candidate.purchasedCardIds)
        ? candidate.purchasedCardIds.filter((entry): entry is string => typeof entry === "string")
        : []
    };
  }
  return out;
}

function enumerateTicTacToeActions(state: CompiledState): CompiledAction[] {
  const board = getBoard(state);
  if (!board) {
    return [];
  }

  const actions: CompiledAction[] = [];
  for (let y = 0; y < board.length; y += 1) {
    const row = board[y];
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === null) {
        actions.push({
          type: "tictactoe_place",
          actor: state.currentPlayer,
          payload: { x, y }
        });
      }
    }
  }
  return actions;
}

function enumerateTakeTokenActions(
  state: CompiledState,
  actor: CompiledPlayerState,
  colors: string[]
): CompiledAction[] {
  const bank = getBank(state);
  if (!bank) {
    return [];
  }

  const actions: CompiledAction[] = [];
  const takePatterns: string[][] = [];

  const singleAvailable = colors.filter((color) => (bank[color] ?? 0) > 0);
  for (let i = 0; i < singleAvailable.length; i += 1) {
    for (let j = i + 1; j < singleAvailable.length; j += 1) {
      for (let k = j + 1; k < singleAvailable.length; k += 1) {
        takePatterns.push([singleAvailable[i], singleAvailable[j], singleAvailable[k]]);
      }
    }
  }

  for (const color of colors) {
    if ((bank[color] ?? 0) >= 4) {
      takePatterns.push([color, color]);
    }
  }

  for (const pattern of takePatterns) {
    const nextTokenCount = totalPlayerTokens(actor) + pattern.length;
    if (nextTokenCount <= getTokenLimit(state)) {
      actions.push({
        type: "take_tokens",
        actor: state.currentPlayer,
        payload: { colors: [...pattern] }
      });
    }
  }

  return actions;
}

function enumerateBuyCardActions(state: CompiledState, actor: CompiledPlayerState): CompiledAction[] {
  const marketIds = getMarketCardIds(state);
  const cardPool = getCardPool(state);
  if (!marketIds || !cardPool) {
    return [];
  }

  const byId = new Map(cardPool.map((card) => [card.id, card]));
  const actions: CompiledAction[] = [];
  for (const cardId of marketIds) {
    const card = byId.get(cardId);
    if (!card) {
      continue;
    }
    if (canAffordCard(actor, card.cost)) {
      actions.push({
        type: "buy_card",
        actor: state.currentPlayer,
        payload: { cardId }
      });
    }
  }
  return actions;
}

function applyTicTacToePlace(
  state: CompiledState,
  actor: CompiledPlayerState,
  action: CompiledAction
): Record<string, unknown> {
  const board = getBoard(state);
  if (!board) {
    throw new Error("tictactoe board is missing.");
  }

  const x = action.payload?.x;
  const y = action.payload?.y;
  if (!isInteger(x) || !isInteger(y) || y < 0 || y >= board.length || x < 0 || x >= board[y].length) {
    throw new Error("tictactoe_place requires valid x/y coordinates.");
  }
  if (board[y][x] !== null) {
    throw new Error("Target cell is already occupied.");
  }

  const mark = actor.mark ?? "X";
  board[y][x] = mark;

  const winnerId = getWinnerId(state, board);
  state.public.winner = winnerId;
  if (winnerId) {
    state.players[winnerId].points = Math.max(1, state.players[winnerId].points);
  }

  return {
    kind: "tictactoe_place",
    x,
    y,
    mark,
    winner: winnerId
  };
}

function applyTakeTokens(
  state: CompiledState,
  actor: CompiledPlayerState,
  action: CompiledAction
): Record<string, unknown> {
  const bank = getBank(state);
  if (!bank) {
    throw new Error("bank is missing.");
  }
  const colors = action.payload?.colors ?? [];
  if (!isValidTakePattern(colors, bank)) {
    throw new Error("Invalid take_tokens pattern.");
  }

  for (const color of colors) {
    bank[color] = (bank[color] ?? 0) - 1;
    actor.tokens[color] = (actor.tokens[color] ?? 0) + 1;
  }

  return {
    kind: "take_tokens",
    colors: [...colors]
  };
}

function applyBuyCard(
  state: CompiledState,
  actor: CompiledPlayerState,
  action: CompiledAction
): Record<string, unknown> {
  const bank = getBank(state);
  const marketIds = getMarketCardIds(state);
  const cardPool = getCardPool(state);
  if (!bank || !marketIds || !cardPool) {
    throw new Error("buy_card requires bank, marketCardIds and cardPool.");
  }

  const cardId = action.payload?.cardId;
  if (!cardId || !marketIds.includes(cardId)) {
    throw new Error("Card is not available in market.");
  }

  const card = cardPool.find((candidate) => candidate.id === cardId);
  if (!card) {
    throw new Error(`Card ${cardId} missing from cardPool.`);
  }

  const payment = computePayment(actor, card.cost);
  for (const color of Object.keys(payment)) {
    if ((actor.tokens[color] ?? 0) < payment[color]) {
      throw new Error(`Card ${cardId} is not affordable.`);
    }
  }

  for (const color of Object.keys(payment)) {
    actor.tokens[color] = (actor.tokens[color] ?? 0) - payment[color];
    bank[color] = (bank[color] ?? 0) + payment[color];
  }

  actor.purchasedCardIds.push(card.id);
  actor.discounts[card.bonusColor] = (actor.discounts[card.bonusColor] ?? 0) + 1;
  actor.points += card.points;
  state.public.marketCardIds = marketIds.filter((id) => id !== card.id);

  return {
    kind: "buy_card",
    cardId: card.id,
    payment
  };
}

function computePayment(actor: CompiledPlayerState, cost: Record<string, number>): Record<string, number> {
  const payment: Record<string, number> = {};
  for (const color of NON_GOLD_COLORS) {
    const required = cost[color] ?? 0;
    const discount = actor.discounts[color] ?? 0;
    payment[color] = Math.max(0, required - discount);
  }
  return payment;
}

function canAffordCard(actor: CompiledPlayerState, cost: Record<string, number>): boolean {
  const payment = computePayment(actor, cost);
  return Object.entries(payment).every(([color, amount]) => (actor.tokens[color] ?? 0) >= amount);
}

function isValidTakePattern(colors: string[], bank: Record<string, number>): boolean {
  if (colors.length === 3) {
    const unique = new Set(colors);
    if (unique.size !== 3) {
      return false;
    }
    return colors.every((color) => (bank[color] ?? 0) > 0);
  }

  if (colors.length === 2) {
    const [a, b] = colors;
    return a === b && (bank[a] ?? 0) >= 4;
  }

  return false;
}

function scoreState(
  state: CompiledState,
  ir: GameIRv0,
  supportedActionKinds: Set<string>
): Record<PlayerId, number> {
  const playerIds = Object.keys(state.players);
  if (ir.scoring.kind === "per_player_points") {
    return Object.fromEntries(playerIds.map((id) => [id, state.players[id].points])) as Record<PlayerId, number>;
  }

  if (supportedActionKinds.has("tictactoe_place")) {
    const winner = typeof state.public.winner === "string" ? state.public.winner : null;
    if (!winner) {
      return Object.fromEntries(playerIds.map((id) => [id, 0])) as Record<PlayerId, number>;
    }
    return Object.fromEntries(playerIds.map((id) => [id, id === winner ? 1 : -1])) as Record<PlayerId, number>;
  }

  return Object.fromEntries(playerIds.map((id) => [id, 0])) as Record<PlayerId, number>;
}

function getNextPlayer(state: CompiledState): string {
  const index = state.playerOrder.indexOf(state.currentPlayer);
  if (index < 0) {
    return state.playerOrder[0];
  }
  return state.playerOrder[(index + 1) % state.playerOrder.length];
}

function getBoard(state: CompiledState): (string | null)[][] | null {
  const board = state.public.board;
  if (!Array.isArray(board)) {
    return null;
  }

  const normalized: (string | null)[][] = [];
  for (const row of board) {
    if (!Array.isArray(row)) {
      return null;
    }
    normalized.push(
      row.map((cell) => {
        if (cell === null || typeof cell === "string") {
          return cell;
        }
        return null;
      })
    );
  }

  state.public.board = normalized;
  return normalized;
}

function getWinnerId(state: CompiledState, board: (string | null)[][]): string | null {
  const lines: Array<[[number, number], [number, number], [number, number]]> = [
    [
      [0, 0],
      [1, 0],
      [2, 0]
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1]
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2]
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2]
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2]
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2]
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2]
    ],
    [
      [2, 0],
      [1, 1],
      [0, 2]
    ]
  ];

  for (const [[x1, y1], [x2, y2], [x3, y3]] of lines) {
    const mark = board[y1][x1];
    if (mark && mark === board[y2][x2] && mark === board[y3][x3]) {
      const winnerEntry = Object.values(state.players).find((player) => player.mark === mark);
      return winnerEntry?.id ?? null;
    }
  }
  return null;
}

function isBoardFull(board: (string | null)[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

function getBank(state: CompiledState): Record<string, number> | null {
  if (!state.public.bank || typeof state.public.bank !== "object") {
    return null;
  }
  return state.public.bank as Record<string, number>;
}

function getMarketCardIds(state: CompiledState): string[] | null {
  if (!Array.isArray(state.public.marketCardIds)) {
    return null;
  }
  return state.public.marketCardIds.filter((entry): entry is string => typeof entry === "string");
}

function getCardPool(state: CompiledState): CompiledCard[] | null {
  if (!Array.isArray(state.public.cardPool)) {
    return null;
  }

  const cards: CompiledCard[] = [];
  for (const entry of state.public.cardPool) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const value = entry as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.points !== "number" || typeof value.bonusColor !== "string") {
      continue;
    }
    cards.push({
      id: value.id,
      cost: normalizeNumberRecord(value.cost),
      points: value.points,
      bonusColor: value.bonusColor
    });
  }
  return cards;
}

function getTokenLimit(state: CompiledState): number {
  return asNumber(state.public.tokenLimit, 10);
}

function totalPlayerTokens(player: CompiledPlayerState): number {
  return Object.values(player.tokens).reduce((sum, value) => sum + value, 0);
}

function canonicalAction(action: CompiledAction): string {
  if (action.type === "tictactoe_place") {
    return `${action.type}|${action.actor}|${action.payload?.x ?? -1}|${action.payload?.y ?? -1}`;
  }
  if (action.type === "take_tokens") {
    const colors = [...(action.payload?.colors ?? [])].sort().join(",");
    return `${action.type}|${action.actor}|${colors}`;
  }
  if (action.type === "buy_card") {
    return `${action.type}|${action.actor}|${action.payload?.cardId ?? ""}`;
  }
  return exhaustiveCheck(action);
}

function withDiff(action: CompiledAction, diff: Record<string, unknown>): CompiledAction {
  return {
    ...action,
    payload: {
      ...(action.payload ?? {}),
      diff
    }
  };
}

function extractTakeColors(ir: GameIRv0): string[] {
  const spec = ir.actions.find((action) => action.kind === "take_tokens");
  if (!spec) {
    return [];
  }
  return [...spec.params.colors];
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "number")
      .map(([key, entry]) => [key, entry as number])
  );
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return '"__undefined__"';
  }
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",");
  return `{${body}}`;
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function exhaustiveCheck(unreachable: never): never {
  throw new Error(`Unhandled variant: ${String(unreachable)}`);
}
