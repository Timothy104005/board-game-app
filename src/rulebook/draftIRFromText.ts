import { checkIR } from "../ir/checker.js";
import { buildGapReport } from "./gapReport.js";
import { extractSignals } from "./extractSignals.js";
import { normalizeRulebookText } from "./normalize.js";
import { segmentRulebook } from "./segment.js";
import type { GapItem, RulebookDraftResult, RulebookSignals } from "./types.js";

interface DraftOptions {
  seedId?: string;
}

type Recognizer = "tictactoe" | "mini_splendor" | "connect4" | "nim" | "pig" | "fallback";

export function draftIRFromRulebookText(text: string, opts: DraftOptions = {}): RulebookDraftResult {
  try {
    const normalizedText = normalizeRulebookText(text);
    const segmented = segmentRulebook(normalizedText);
    const signals = extractSignals({
      text: normalizedText,
      lines: segmented.lines,
      sections: segmented.sections
    });

    const selectedRecognizer = chooseRecognizer(signals);
    const irDraft = buildDraft(selectedRecognizer, signals, opts);
    const checkerResult = checkIR(irDraft);
    const report = buildGapReport(irDraft, checkerResult, {
      selectedRecognizer,
      signals,
      sections: segmented.sections,
      normalizedTextHash: stableHash(normalizedText)
    });

    return {
      irDraft,
      gaps: report.gaps,
      debug: {
        selectedRecognizer,
        normalizedTextHash: stableHash(normalizedText),
        sections: segmented.sections,
        signals,
        checker: checkerResult,
        gapSummary: report.summary,
        notes: report.notes
      }
    };
  } catch (error) {
    const irDraft = createFallbackDraft(opts.seedId, undefined);
    const message = error instanceof Error ? error.message : String(error);
    const gaps: GapItem[] = [
      {
        filePointer: "/",
        severity: "error",
        message: `Pipeline failure: ${message}`,
        suggestedFix: "Check rulebook text format and retry with explicit game cues."
      }
    ];
    return {
      irDraft,
      gaps,
      debug: {
        selectedRecognizer: "fallback_on_error",
        fatalError: message
      }
    };
  }
}

function chooseRecognizer(signals: RulebookSignals): Recognizer {
  const candidates: Array<{ key: Recognizer; score: number; precedence: number }> = [
    { key: "tictactoe", score: signals.confidence.tictactoe, precedence: 0 },
    { key: "mini_splendor", score: signals.confidence.miniSplendor, precedence: 1 },
    { key: "connect4", score: signals.confidence.connect4, precedence: 2 },
    { key: "nim", score: signals.confidence.nim, precedence: 3 },
    { key: "pig", score: signals.confidence.pig, precedence: 4 }
  ];

  const highConfidence = candidates.filter((candidate) => candidate.score >= 0.9);
  if (highConfidence.length === 0) {
    return "fallback";
  }

  highConfidence.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.precedence - b.precedence;
  });
  return highConfidence[0].key;
}

function buildDraft(recognizer: Recognizer, signals: RulebookSignals, opts: DraftOptions): unknown {
  if (recognizer === "tictactoe") {
    return createTictactoeDraft(opts.seedId);
  }
  if (recognizer === "mini_splendor") {
    return createMiniSplendorDraft(opts.seedId);
  }
  if (recognizer === "connect4") {
    return createConnect4Draft(opts.seedId);
  }
  if (recognizer === "nim") {
    return createNimDraft(opts.seedId);
  }
  if (recognizer === "pig") {
    return createPigDraft(opts.seedId);
  }
  return createFallbackDraft(opts.seedId, signals);
}

function createTictactoeDraft(seedId?: string): unknown {
  return {
    meta: {
      id: seedId ? `tictactoe_ir_${seedId}` : "tictactoe_ir",
      name: "Tic-Tac-Toe IR",
      playersMin: 2,
      playersMax: 2
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0",
        board: [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ],
        winner: null
      },
      players: {
        "0": {
          id: "0",
          mark: "X",
          points: 0
        },
        "1": {
          id: "1",
          mark: "O",
          points: 0
        }
      }
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [
      {
        kind: "tictactoe_place",
        params: {
          x: [0, 1, 2],
          y: [0, 1, 2]
        }
      }
    ],
    end: {
      kind: "turn_limit",
      maxTurns: 9
    },
    scoring: {
      kind: "zero_sum"
    }
  };
}

function createMiniSplendorDraft(seedId?: string): unknown {
  return {
    meta: {
      id: seedId ? `mini_splendor_ir_${seedId}` : "mini_splendor_ir",
      name: "Mini Splendor IR",
      playersMin: 2,
      playersMax: 2
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0",
        tokenLimit: 10,
        bank: {
          white: 4,
          blue: 4,
          green: 4,
          red: 4,
          black: 4,
          gold: 5
        },
        cardPool: [
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
        ],
        marketCardIds: ["c1", "c2", "c3", "c4", "c5", "c6"]
      },
      players: {
        "0": {
          id: "0",
          points: 0,
          tokens: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
          discounts: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
          purchasedCardIds: []
        },
        "1": {
          id: "1",
          points: 0,
          tokens: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
          discounts: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
          purchasedCardIds: []
        }
      }
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [
      {
        kind: "take_tokens",
        params: {
          colors: ["white", "blue", "green", "red", "black"]
        }
      },
      {
        kind: "buy_card",
        params: {
          cardIds: ["c1", "c2", "c3", "c4", "c5", "c6"]
        }
      }
    ],
    end: {
      kind: "turn_limit",
      maxTurns: 50
    },
    scoring: {
      kind: "per_player_points"
    },
    invariants: {
      resourceBounds: [
        { path: "public.bank.white", min: 0, max: 4 },
        { path: "public.bank.blue", min: 0, max: 4 },
        { path: "public.bank.green", min: 0, max: 4 },
        { path: "public.bank.red", min: 0, max: 4 },
        { path: "public.bank.black", min: 0, max: 4 },
        { path: "public.bank.gold", min: 0, max: 5 }
      ]
    }
  };
}

function createConnect4Draft(seedId?: string): unknown {
  return {
    meta: {
      id: seedId ? `connect4_ir_${seedId}` : "connect4_ir",
      name: "Connect Four IR",
      playersMin: 2,
      playersMax: 2
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0",
        board: [
          [null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null]
        ],
        winner: null
      },
      players: {
        "0": {
          id: "0",
          mark: "X",
          points: 0
        },
        "1": {
          id: "1",
          mark: "O",
          points: 0
        }
      }
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [
      {
        kind: "connect4_drop",
        params: {
          columns: [0, 1, 2, 3, 4, 5, 6]
        }
      }
    ],
    end: {
      kind: "turn_limit",
      maxTurns: 42
    },
    scoring: {
      kind: "zero_sum"
    }
  };
}

function createNimDraft(seedId?: string): unknown {
  return {
    meta: {
      id: seedId ? `nim_ir_${seedId}` : "nim_ir",
      name: "Nim IR",
      playersMin: 2,
      playersMax: 2
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0",
        piles: [3, 4, 5],
        winner: null
      },
      players: {
        "0": {
          id: "0",
          points: 0
        },
        "1": {
          id: "1",
          points: 0
        }
      }
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [
      {
        kind: "take_from_pile",
        params: {
          minTake: 1,
          maxTake: 3,
          pileIndexes: [0, 1, 2]
        }
      }
    ],
    end: {
      kind: "turn_limit",
      maxTurns: 50
    },
    scoring: {
      kind: "zero_sum"
    }
  };
}

function createPigDraft(seedId?: string): unknown {
  return {
    meta: {
      id: seedId ? `pig_ir_${seedId}` : "pig_ir",
      name: "Pig Dice IR",
      playersMin: 2,
      playersMax: 2
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0",
        turnTotal: 0
      },
      players: {
        "0": {
          id: "0",
          points: 0
        },
        "1": {
          id: "1",
          points: 0
        }
      }
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [
      {
        kind: "pig_roll",
        params: {}
      },
      {
        kind: "pig_hold",
        params: {}
      }
    ],
    end: {
      kind: "score_at_least",
      target: 20
    },
    scoring: {
      kind: "per_player_points"
    }
  };
}

function createFallbackDraft(seedId: string | undefined, signals: RulebookSignals | undefined): unknown {
  const playerMin = signals?.players?.min ?? 2;
  const playerMax = signals?.players?.max ?? playerMin;
  return {
    meta: {
      id: seedId ? `unknown_ir_${seedId}` : "unknown_ir_draft",
      name: "Unknown Rulebook Draft",
      playersMin: playerMin,
      playersMax: playerMax
    },
    rng: {
      seedable: true
    },
    state: {
      public: {
        phase: "main",
        stage: "action",
        turn: 0,
        currentPlayer: "0"
      },
      players: {}
    },
    turn: {
      order: "round_robin",
      phases: ["main"]
    },
    actions: [],
    end: {
      kind: "never"
    },
    scoring: {
      kind: "per_player_points"
    }
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
