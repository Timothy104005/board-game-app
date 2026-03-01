export type RulebookSectionKind = "heading" | "bullets" | "paragraphs";

export interface RulebookSection {
  title?: string;
  start: number;
  end: number;
  kind: RulebookSectionKind;
}

export interface RulebookSegments {
  lines: string[];
  sections: RulebookSection[];
}

export interface RulebookSignals {
  players?: {
    min?: number;
    max?: number;
  };
  setupHints: string[];
  turnHints: string[];
  actionHints: string[];
  endHints: string[];
  scoringHints: string[];
  keywords: string[];
  possibleUnsupportedActionKinds: string[];
  confidence: {
    tictactoe: number;
    miniSplendor: number;
    connect4: number;
    nim: number;
    pig: number;
  };
}

export interface GapItem {
  filePointer: string;
  severity: "error" | "warning";
  message: string;
  suggestedFix?: string;
}

export interface RulebookDraftResult {
  irDraft: unknown;
  gaps: GapItem[];
  debug: Record<string, unknown>;
}
