import type { PlayerId, RNG, StepResult } from "../../engine/contracts.js";
import {
  createBuyCardAction,
  createTakeTokensAction,
  type SplendorAction,
  type TakeTokensAction
} from "./actions.js";
import {
  NON_GOLD_COLORS,
  TOKEN_COLORS,
  createInitialState,
  totalTokens,
  type NonGoldTokenColor,
  type SplendorCard,
  type SplendorCardCost,
  type SplendorPlayerState,
  type SplendorState,
  type TokenColor
} from "./state.js";

export function initialState(seed: string): SplendorState {
  return createInitialState(seed);
}

export function legalActions(state: SplendorState): SplendorAction[] {
  if (state.phase === "end" || state.turn >= state.maxTurns) {
    return [];
  }

  const actor = getPlayer(state, state.currentPlayer);
  return [...enumerateLegalTakeActions(state, actor), ...enumerateLegalBuyActions(state, actor)];
}

export function applyAction(
  state: SplendorState,
  action: SplendorAction,
  rng: RNG
): StepResult<SplendorState, SplendorAction> {
  if (isTerminal(state)) {
    throw new Error("Cannot apply action to terminal state.");
  }
  if (action.actor !== state.currentPlayer) {
    throw new Error("Only the current player may act.");
  }

  const available = legalActions(state);
  if (!isLegalAction(available, action)) {
    throw new Error(`Illegal action: ${action.type}`);
  }

  const stateHashBefore = stableHash(state);
  const next = cloneState(state);
  const actor = getPlayer(next, action.actor);

  switch (action.type) {
    case "take_tokens":
      applyTakeTokens(next, actor, action);
      break;
    case "buy_card":
      applyBuyCard(next, actor, action.payload?.cardId);
      break;
    default:
      exhaustiveCheck(action);
  }

  if (totalTokens(actor.tokens) > next.tokenLimit) {
    throw new Error("Token limit exceeded after action.");
  }
  advanceTurn(next);

  const terminal = isTerminal(next);
  if (terminal) {
    next.phase = "end";
    next.stage = null;
  } else {
    next.phase = "main";
    next.stage = "action";
  }

  const stateHashAfter = stableHash(next);
  return {
    state: next,
    terminal,
    scores: terminal ? score(next) : undefined,
    replayEvent: {
      index: state.turn,
      seed: rng.seed,
      turn: next.turn,
      phase: next.phase,
      actor: action.actor,
      action,
      stateHashBefore,
      stateHashAfter,
      stage: next.stage
    }
  };
}

export function isTerminal(state: SplendorState): boolean {
  if (state.phase === "end" || state.turn >= state.maxTurns) {
    return true;
  }
  return legalActions(state).length === 0;
}

export function score(state: SplendorState): Record<PlayerId, number> {
  return Object.fromEntries(state.players.map((player) => [player.id, player.points])) as Record<PlayerId, number>;
}

export const splendorEngine = {
  initialState,
  legalActions,
  applyAction,
  isTerminal,
  score
};

function enumerateLegalTakeActions(state: SplendorState, actor: SplendorPlayerState): SplendorAction[] {
  const actions: SplendorAction[] = [];
  const patterns = enumerateTakePatterns(state);

  for (const take of patterns) {
    const tokensAfterTake = cloneTokenPool(actor.tokens);
    for (const color of take) {
      tokensAfterTake[color] += 1;
    }

    const overflow = totalTokens(tokensAfterTake) - state.tokenLimit;
    if (overflow <= 0) {
      actions.push(createTakeTokensAction(actor.id, take, []));
      continue;
    }

    const discardOptions = enumerateDiscardOptions(tokensAfterTake, overflow);
    for (const discard of discardOptions) {
      actions.push(createTakeTokensAction(actor.id, take, discard));
    }
  }

  return actions;
}

function enumerateLegalBuyActions(state: SplendorState, actor: SplendorPlayerState): SplendorAction[] {
  const actions: SplendorAction[] = [];

  for (const cardId of state.marketCardIds) {
    const card = getCardById(state, cardId);
    if (!card) {
      continue;
    }
    if (canAffordCard(actor, card.cost)) {
      actions.push(createBuyCardAction(actor.id, card.id));
    }
  }

  return actions;
}

function enumerateTakePatterns(state: SplendorState): NonGoldTokenColor[][] {
  const patterns: NonGoldTokenColor[][] = [];
  const availableForSingle = NON_GOLD_COLORS.filter((color) => state.bank[color] > 0);

  for (let i = 0; i < availableForSingle.length; i += 1) {
    for (let j = i + 1; j < availableForSingle.length; j += 1) {
      for (let k = j + 1; k < availableForSingle.length; k += 1) {
        patterns.push([availableForSingle[i], availableForSingle[j], availableForSingle[k]]);
      }
    }
  }

  const availableForDouble = NON_GOLD_COLORS.filter((color) => state.bank[color] >= 4);
  for (const color of availableForDouble) {
    patterns.push([color, color]);
  }

  return patterns;
}

function enumerateDiscardOptions(tokens: Record<TokenColor, number>, discardCount: number): TokenColor[][] {
  if (discardCount <= 0) {
    return [[]];
  }

  const pool = cloneTokenPool(tokens);
  const current: TokenColor[] = [];
  const options: TokenColor[][] = [];

  const dfs = (startIndex: number, remaining: number): void => {
    if (remaining === 0) {
      options.push([...current]);
      return;
    }

    for (let i = startIndex; i < TOKEN_COLORS.length; i += 1) {
      const color = TOKEN_COLORS[i];
      if (pool[color] <= 0) {
        continue;
      }

      pool[color] -= 1;
      current.push(color);
      dfs(i, remaining - 1);
      current.pop();
      pool[color] += 1;
    }
  };

  dfs(0, discardCount);
  return options;
}

function applyTakeTokens(state: SplendorState, actor: SplendorPlayerState, action: TakeTokensAction): void {
  const payload = action.payload;
  if (!payload) {
    throw new Error("take_tokens requires payload.");
  }

  const take = payload.take ?? [];
  if (!isValidTakePattern(take, state)) {
    throw new Error("Invalid take_tokens pattern.");
  }

  for (const color of take) {
    state.bank[color] -= 1;
    actor.tokens[color] += 1;
  }

  const discard = payload.discard ?? [];
  const overflow = totalTokens(actor.tokens) - state.tokenLimit;
  if (overflow <= 0 && discard.length > 0) {
    throw new Error("Discard is only allowed when token limit is exceeded.");
  }
  if (overflow > 0 && discard.length !== overflow) {
    throw new Error(`Discard count must be exactly ${overflow} to satisfy token limit.`);
  }

  for (const color of discard) {
    if (!isTokenColor(color)) {
      throw new Error(`Invalid discard color: ${String(color)}`);
    }
    if (actor.tokens[color] <= 0) {
      throw new Error(`Cannot discard unavailable token: ${color}`);
    }

    actor.tokens[color] -= 1;
    state.bank[color] += 1;
  }

  if (totalTokens(actor.tokens) > state.tokenLimit) {
    throw new Error("Token limit exceeded after discard.");
  }
}

function applyBuyCard(state: SplendorState, actor: SplendorPlayerState, cardId: string | undefined): void {
  if (!cardId) {
    throw new Error("buy_card requires cardId.");
  }
  if (!state.marketCardIds.includes(cardId)) {
    throw new Error(`Card ${cardId} is not available in market.`);
  }

  const card = getCardById(state, cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found in pool.`);
  }

  const payment = getRequiredPayment(actor, card.cost);
  for (const color of NON_GOLD_COLORS) {
    if (actor.tokens[color] < payment[color]) {
      throw new Error(`Cannot afford card ${card.id}.`);
    }
  }

  for (const color of NON_GOLD_COLORS) {
    const paid = payment[color];
    actor.tokens[color] -= paid;
    state.bank[color] += paid;
  }

  actor.purchasedCardIds.push(card.id);
  actor.discounts[card.bonusColor] += 1;
  actor.points += card.points;
  state.marketCardIds = state.marketCardIds.filter((id) => id !== card.id);
}

function canAffordCard(actor: SplendorPlayerState, cost: SplendorCardCost): boolean {
  const payment = getRequiredPayment(actor, cost);
  return NON_GOLD_COLORS.every((color) => actor.tokens[color] >= payment[color]);
}

function getRequiredPayment(
  actor: SplendorPlayerState,
  cost: SplendorCardCost
): Record<NonGoldTokenColor, number> {
  const payment = {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0
  };

  for (const color of NON_GOLD_COLORS) {
    const required = cost[color] ?? 0;
    payment[color] = Math.max(0, required - actor.discounts[color]);
  }

  return payment;
}

function getCardById(state: SplendorState, cardId: string): SplendorCard | undefined {
  return state.cardPool.find((card) => card.id === cardId);
}

function isValidTakePattern(take: readonly NonGoldTokenColor[], state: SplendorState): boolean {
  if (take.length === 3) {
    const unique = new Set(take);
    if (unique.size !== 3) {
      return false;
    }
    return take.every((color) => isNonGoldColor(color) && state.bank[color] >= 1);
  }

  if (take.length === 2) {
    const [a, b] = take;
    if (a !== b) {
      return false;
    }
    return isNonGoldColor(a) && state.bank[a] >= 4;
  }

  return false;
}

function isLegalAction(available: SplendorAction[], action: SplendorAction): boolean {
  const candidateKey = canonicalAction(action);
  return available.some((candidate) => canonicalAction(candidate) === candidateKey);
}

function canonicalAction(action: SplendorAction): string {
  if (action.type === "take_tokens") {
    const take = [...(action.payload?.take ?? [])].sort(compareTokenColor).join(",");
    const discard = [...(action.payload?.discard ?? [])].sort(compareTokenColor).join(",");
    return `${action.type}|${action.actor}|${take}|${discard}`;
  }
  if (action.type === "buy_card") {
    return `${action.type}|${action.actor}|${action.payload?.cardId ?? ""}`;
  }
  return exhaustiveCheck(action);
}

function compareTokenColor(a: TokenColor, b: TokenColor): number {
  return TOKEN_COLORS.indexOf(a) - TOKEN_COLORS.indexOf(b);
}

function isNonGoldColor(color: string): color is NonGoldTokenColor {
  return (NON_GOLD_COLORS as readonly string[]).includes(color);
}

function isTokenColor(color: string): color is TokenColor {
  return (TOKEN_COLORS as readonly string[]).includes(color);
}

function getPlayer(state: SplendorState, playerId: PlayerId): SplendorPlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Missing player: ${playerId}`);
  }
  return player;
}

function advanceTurn(state: SplendorState): void {
  state.turn += 1;

  if (state.players.length === 1) {
    return;
  }

  const currentPlayerIndex = state.players.findIndex((candidate) => candidate.id === state.currentPlayer);
  if (currentPlayerIndex < 0) {
    throw new Error(`Current player not found: ${state.currentPlayer}`);
  }
  const nextPlayerIndex = (currentPlayerIndex + 1) % state.players.length;
  state.currentPlayer = state.players[nextPlayerIndex].id;
}

function cloneState(state: SplendorState): SplendorState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      tokens: cloneTokenPool(player.tokens),
      discounts: { ...player.discounts },
      purchasedCardIds: [...player.purchasedCardIds]
    })),
    bank: cloneTokenPool(state.bank),
    cardPool: state.cardPool.map((card) => ({ ...card, cost: { ...card.cost } })),
    marketCardIds: [...state.marketCardIds]
  };
}

function cloneTokenPool(pool: Record<TokenColor, number>): Record<TokenColor, number> {
  return {
    white: pool.white,
    blue: pool.blue,
    green: pool.green,
    red: pool.red,
    black: pool.black,
    gold: pool.gold
  };
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
  throw new Error(`Unhandled action variant: ${String(unreachable)}`);
}
