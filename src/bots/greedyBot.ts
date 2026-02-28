import type { Action, State } from "../engine/contracts.js";
import type { Bot } from "./types.js";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
] as const;

export function createGreedyBot<S extends State = State, A extends Action = Action>(id: string): Bot<S, A> {
  return {
    id,
    chooseAction: (ctx) => {
      const splendorChoice = chooseSplendorGreedy(ctx.legalActions, ctx.state);
      if (splendorChoice) {
        return splendorChoice as A;
      }

      const tttChoice = chooseTicTacToeGreedy(ctx.legalActions, ctx.state, ctx.rng);
      if (tttChoice) {
        return tttChoice as A;
      }

      if (ctx.legalActions.length === 0) {
        throw new Error("greedy bot cannot choose from empty legalActions.");
      }
      const index = ctx.rng.nextInt(0, ctx.legalActions.length - 1);
      return ctx.legalActions[index];
    },
    explain: () => "chooses best immediate tactical move for known games"
  };
}

function chooseSplendorGreedy(legalActions: Action[], state: unknown): Action | null {
  const buyActions = legalActions.filter((action) => action.type === "buy_card");
  if (buyActions.length === 0) {
    return null;
  }

  const cardMap = extractCardMap(state);
  const scored = buyActions.map((action) => {
    const cardId = asRecord(action.payload)?.cardId;
    const card = typeof cardId === "string" ? cardMap.get(cardId) : undefined;
    const points = typeof card?.points === "number" ? card.points : 0;
    return {
      action,
      score: points * 100 + 1
    };
  });

  scored.sort((a, b) => b.score - a.score || actionKey(a.action).localeCompare(actionKey(b.action)));
  return scored[0].action;
}

function chooseTicTacToeGreedy(legalActions: Action[], state: unknown, rng: { nextInt(min: number, max: number): number }): Action | null {
  const tttActions = legalActions.filter((action) => action.type === "place_mark" || action.type === "tictactoe_place");
  if (tttActions.length === 0) {
    return null;
  }

  const board = extractTicTacToeBoard(state);
  if (!board) {
    return null;
  }

  const currentMark = extractCurrentMark(state);
  const opponentMark = currentMark === "X" ? "O" : "X";

  const winNow = tttActions.find((action) => {
    const index = actionToIndex(action);
    if (index < 0 || board[index] !== null) {
      return false;
    }
    const trial = [...board];
    trial[index] = currentMark;
    return isWinningBoard(trial, currentMark);
  });
  if (winNow) {
    return winNow;
  }

  const blockNow = tttActions.find((action) => {
    const index = actionToIndex(action);
    if (index < 0 || board[index] !== null) {
      return false;
    }
    const trial = [...board];
    trial[index] = opponentMark;
    return isWinningBoard(trial, opponentMark);
  });
  if (blockNow) {
    return blockNow;
  }

  const center = tttActions.find((action) => actionToIndex(action) === 4);
  if (center) {
    return center;
  }

  for (const corner of [0, 2, 6, 8]) {
    const cornerAction = tttActions.find((action) => actionToIndex(action) === corner);
    if (cornerAction) {
      return cornerAction;
    }
  }

  const index = rng.nextInt(0, tttActions.length - 1);
  return tttActions[index];
}

function extractCardMap(state: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();

  const asObj = asRecord(state);
  if (!asObj) {
    return map;
  }

  const directPool = asObj.cardPool;
  if (Array.isArray(directPool)) {
    for (const entry of directPool) {
      const card = asRecord(entry);
      if (card && typeof card.id === "string") {
        map.set(card.id, card);
      }
    }
  }

  const publicPool = asRecord(asObj.public)?.cardPool;
  if (Array.isArray(publicPool)) {
    for (const entry of publicPool) {
      const card = asRecord(entry);
      if (card && typeof card.id === "string") {
        map.set(card.id, card);
      }
    }
  }

  return map;
}

function extractTicTacToeBoard(state: unknown): Array<"X" | "O" | null> | null {
  const asObj = asRecord(state);
  if (!asObj) {
    return null;
  }

  if (Array.isArray(asObj.board)) {
    const oneDim = asObj.board as unknown[];
    if (oneDim.length === 9) {
      return oneDim.map((cell) => (cell === "X" || cell === "O" ? cell : null));
    }
  }

  const publicBoard = asRecord(asObj.public)?.board;
  if (Array.isArray(publicBoard) && publicBoard.length === 3 && Array.isArray(publicBoard[0])) {
    const flattened: Array<"X" | "O" | null> = [];
    for (const row of publicBoard as unknown[][]) {
      for (const cell of row) {
        flattened.push(cell === "X" || cell === "O" ? cell : null);
      }
    }
    if (flattened.length === 9) {
      return flattened;
    }
  }

  return null;
}

function extractCurrentMark(state: unknown): "X" | "O" {
  const asObj = asRecord(state);
  if (!asObj) {
    return "X";
  }

  const currentPlayer = typeof asObj.currentPlayer === "string" ? asObj.currentPlayer : undefined;
  if (!currentPlayer) {
    return "X";
  }

  if (Array.isArray(asObj.players)) {
    const player = (asObj.players as unknown[])
      .map((entry) => asRecord(entry))
      .find((entry) => entry && entry.id === currentPlayer);
    const mark = player?.mark;
    if (mark === "X" || mark === "O") {
      return mark;
    }
  }

  const playerMap = asRecord(asObj.players);
  const mapped = playerMap ? asRecord(playerMap[currentPlayer]) : undefined;
  const mapMark = mapped?.mark;
  if (mapMark === "X" || mapMark === "O") {
    return mapMark;
  }

  return currentPlayer === "1" ? "O" : "X";
}

function actionToIndex(action: Action): number {
  if (action.type === "place_mark") {
    const index = asRecord(action.payload)?.index;
    return typeof index === "number" ? index : -1;
  }
  if (action.type === "tictactoe_place") {
    const payload = asRecord(action.payload);
    const x = payload?.x;
    const y = payload?.y;
    if (typeof x === "number" && typeof y === "number") {
      return y * 3 + x;
    }
  }
  return -1;
}

function isWinningBoard(board: Array<"X" | "O" | null>, mark: "X" | "O"): boolean {
  return WIN_LINES.some(([a, b, c]) => board[a] === mark && board[b] === mark && board[c] === mark);
}

function actionKey(action: Action): string {
  return `${action.type}|${action.actor}|${JSON.stringify(action.payload ?? {})}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
