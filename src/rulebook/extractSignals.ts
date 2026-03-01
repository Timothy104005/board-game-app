import type { RulebookSection, RulebookSignals } from "./types.js";

interface ExtractSignalsInput {
  text: string;
  lines: string[];
  sections: RulebookSection[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6
};

export function extractSignals(input: ExtractSignalsInput): RulebookSignals {
  const normalizedText = input.text.toLowerCase();
  const lowerLines = input.lines.map((line) => line.toLowerCase());

  const players = detectPlayers(normalizedText);
  const setupHints = collectHintLines(lowerLines, ["setup", "start", "begin", "initial"]);
  const turnHints = collectHintLines(lowerLines, ["turn", "alternate", "round", "player acts"]);
  const actionHints = collectHintLines(lowerLines, [
    "action",
    "place",
    "mark",
    "take",
    "buy",
    "card",
    "discount",
    "token",
    "drop",
    "remove",
    "roll",
    "hold"
  ]);
  const endHints = collectHintLines(lowerLines, [
    "win",
    "draw",
    "end",
    "turn limit",
    "three in a row",
    "four in a row",
    "last move wins"
  ]);
  const scoringHints = collectHintLines(lowerLines, ["point", "score", "wins"]);
  const keywords = collectKeywords(normalizedText);
  const possibleUnsupportedActionKinds = collectUnsupportedKinds(normalizedText);
  const confidence = {
    tictactoe: scoreTictactoeConfidence(normalizedText),
    miniSplendor: scoreMiniSplendorConfidence(normalizedText),
    connect4: scoreConnect4Confidence(normalizedText),
    nim: scoreNimConfidence(normalizedText),
    pig: scorePigConfidence(normalizedText)
  };

  return {
    players,
    setupHints,
    turnHints,
    actionHints,
    endHints,
    scoringHints,
    keywords,
    possibleUnsupportedActionKinds,
    confidence
  };
}

function detectPlayers(text: string): RulebookSignals["players"] {
  const exactNumericMatch = text.match(/\b([1-9])\s+players?\b/);
  if (exactNumericMatch) {
    const value = Number.parseInt(exactNumericMatch[1], 10);
    return { min: value, max: value };
  }

  const exactWordMatch = text.match(/\b(one|two|three|four|five|six)\s+players?\b/);
  if (exactWordMatch) {
    const mapped = NUMBER_WORDS[exactWordMatch[1]];
    return { min: mapped, max: mapped };
  }

  const rangeMatch = text.match(/\b([1-9])\s*-\s*([1-9])\s+players?\b/);
  if (rangeMatch) {
    const min = Number.parseInt(rangeMatch[1], 10);
    const max = Number.parseInt(rangeMatch[2], 10);
    return { min, max };
  }

  return undefined;
}

function collectHintLines(lines: string[], needles: string[]): string[] {
  const hints: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }
    if (needles.some((needle) => line.includes(needle))) {
      if (!hints.includes(line)) {
        hints.push(line);
      }
    }
  }
  return hints;
}

function collectKeywords(text: string): string[] {
  const keywords = [
    "tic tac toe",
    "3x3",
    "x and o",
    "three in a row",
    "tokens",
    "buy card",
    "discount",
    "points",
    "take 3 different",
    "take three different",
    "connect four",
    "4 in a row",
    "7 columns",
    "6 rows",
    "nim",
    "pile",
    "remove 1-3 stones",
    "last move wins",
    "pig",
    "roll a die",
    "hold",
    "turn total"
  ];

  const found: string[] = [];
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      found.push(keyword);
    }
  }
  return found;
}

function collectUnsupportedKinds(text: string): string[] {
  const unsupported = ["reserve", "noble", "auction", "attack", "trade", "negotiate", "bid", "spell"];

  const found: string[] = [];
  for (const item of unsupported) {
    if (text.includes(item)) {
      found.push(item);
    }
  }
  return found;
}

function scoreTictactoeConfidence(text: string): number {
  let score = 0;
  if (text.includes("tic tac toe")) {
    score += 0.45;
  }
  if (text.includes("3x3") || text.includes("3 x 3")) {
    score += 0.2;
  }
  if (text.includes("x and o") || text.includes("x/o")) {
    score += 0.2;
  }
  if (/\bx\s+and\s+.*\bo\b/.test(text)) {
    score += 0.15;
  }
  if (text.includes("three in a row")) {
    score += 0.2;
  }
  return clamp01(score);
}

function scoreMiniSplendorConfidence(text: string): number {
  let score = 0;
  if (text.includes("tokens")) {
    score += 0.2;
  }
  if (text.includes("buy card")) {
    score += 0.25;
  }
  if (text.includes("discount")) {
    score += 0.2;
  }
  if (text.includes("points")) {
    score += 0.15;
  }
  if (text.includes("take 3 different") || text.includes("take three different")) {
    score += 0.2;
  }
  return clamp01(score);
}

function scoreConnect4Confidence(text: string): number {
  let score = 0;
  if (text.includes("connect four")) {
    score += 0.45;
  }
  if (text.includes("4 in a row") || text.includes("four in a row")) {
    score += 0.25;
  }
  if (text.includes("7 columns")) {
    score += 0.2;
  }
  if (text.includes("6 rows")) {
    score += 0.2;
  }
  return clamp01(score);
}

function scoreNimConfidence(text: string): number {
  let score = 0;
  if (text.includes("nim")) {
    score += 0.45;
  }
  if (text.includes("pile")) {
    score += 0.15;
  }
  if (text.includes("remove 1-3 stones") || text.includes("remove 1 to 3 stones")) {
    score += 0.3;
  }
  if (text.includes("last move wins")) {
    score += 0.25;
  }
  return clamp01(score);
}

function scorePigConfidence(text: string): number {
  let score = 0;
  if (text.includes("pig")) {
    score += 0.35;
  }
  if (text.includes("roll a die") || text.includes("roll die")) {
    score += 0.25;
  }
  if (text.includes("hold")) {
    score += 0.2;
  }
  if (text.includes("turn total")) {
    score += 0.2;
  }
  return clamp01(score);
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
