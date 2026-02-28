import type { Phase, PlayerId, Stage } from "../../engine/contracts.js";

export type TokenColor = "white" | "blue" | "green" | "red" | "black" | "gold";
export type NonGoldTokenColor = Exclude<TokenColor, "gold">;
export type SplendorCardCost = Partial<Record<NonGoldTokenColor, number>>;

export interface SplendorCard {
  id: string;
  cost: SplendorCardCost;
  points: number;
  bonusColor: NonGoldTokenColor;
}

export const NON_GOLD_COLORS: readonly NonGoldTokenColor[] = ["white", "blue", "green", "red", "black"];
export const TOKEN_COLORS: readonly TokenColor[] = [...NON_GOLD_COLORS, "gold"];

export const DEFAULT_NON_GOLD_SUPPLY = 4;
export const DEFAULT_GOLD_SUPPLY = 5;
export const DEFAULT_MAX_TURNS = 100;
export const TOKEN_LIMIT_PER_PLAYER = 10;
export const FIXED_CARD_POOL: readonly SplendorCard[] = [
  {
    id: "c1",
    cost: { blue: 1, green: 1, red: 1 },
    points: 0,
    bonusColor: "white"
  },
  {
    id: "c2",
    cost: { white: 1, green: 1, black: 1 },
    points: 0,
    bonusColor: "blue"
  },
  {
    id: "c3",
    cost: { white: 2, blue: 1, red: 1 },
    points: 1,
    bonusColor: "green"
  },
  {
    id: "c4",
    cost: { blue: 2, green: 1, black: 1 },
    points: 1,
    bonusColor: "red"
  },
  {
    id: "c5",
    cost: { white: 1, red: 2, green: 1 },
    points: 1,
    bonusColor: "black"
  },
  {
    id: "c6",
    cost: { blue: 2, green: 2, red: 1, black: 1 },
    points: 2,
    bonusColor: "white"
  }
];

export interface SplendorPlayerState {
  id: PlayerId;
  tokens: Record<TokenColor, number>;
  points: number;
  discounts: Record<NonGoldTokenColor, number>;
  purchasedCardIds: string[];
}

export interface SplendorState {
  seed: string;
  turn: number;
  phase: Phase;
  stage: Stage;
  currentPlayer: PlayerId;
  players: SplendorPlayerState[];
  bank: Record<TokenColor, number>;
  cardPool: SplendorCard[];
  marketCardIds: string[];
  maxTurns: number;
  tokenLimit: number;
}

export function createEmptyTokenPool(): Record<TokenColor, number> {
  return {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0
  };
}

export function createInitialState(seed: string, playerIds: readonly PlayerId[] = ["0", "1"]): SplendorState {
  if (playerIds.length === 0) {
    throw new Error("Splendor requires at least one player.");
  }
  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) {
    throw new Error("Player ids must be unique.");
  }

  return {
    seed,
    turn: 0,
    phase: "main",
    stage: "action",
    currentPlayer: playerIds[0],
    players: playerIds.map((id) => ({
      id,
      tokens: createEmptyTokenPool(),
      points: 0,
      discounts: {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0
      },
      purchasedCardIds: []
    })),
    bank: {
      white: DEFAULT_NON_GOLD_SUPPLY,
      blue: DEFAULT_NON_GOLD_SUPPLY,
      green: DEFAULT_NON_GOLD_SUPPLY,
      red: DEFAULT_NON_GOLD_SUPPLY,
      black: DEFAULT_NON_GOLD_SUPPLY,
      gold: DEFAULT_GOLD_SUPPLY
    },
    cardPool: FIXED_CARD_POOL.map((card) => ({
      ...card,
      cost: { ...card.cost }
    })),
    marketCardIds: FIXED_CARD_POOL.map((card) => card.id),
    maxTurns: DEFAULT_MAX_TURNS,
    tokenLimit: TOKEN_LIMIT_PER_PLAYER
  };
}

export function totalTokens(tokens: Record<TokenColor, number>): number {
  return TOKEN_COLORS.reduce((sum, color) => sum + tokens[color], 0);
}
