import type { IRPatch } from "../ir/patch.js";
import type { GapItem } from "./types.js";

export interface PatchTemplateSuggestion {
  patchTemplate: IRPatch;
  notes: string[];
}

export function suggestPatchTemplate(_irDraft: unknown, gaps: GapItem[]): PatchTemplateSuggestion {
  const errorPointers = [...new Set(gaps.filter((gap) => gap.severity === "error").map((gap) => gap.filePointer))].sort();
  const operations = errorPointers.map((pointer) => ({
    op: "set" as const,
    path: pointer,
    value: placeholderForPointer(pointer)
  }));

  return {
    patchTemplate: {
      operations
    },
    notes: [
      "Patch template is deterministic and generated from error gaps only.",
      `Error pointers: ${errorPointers.length}.`,
      "Replace TODO placeholders with concrete values, then run applyPatch CLI."
    ]
  };
}

function placeholderForPointer(pointer: string): unknown {
  if (pointer === "/meta/name") {
    return "TODO_NAME";
  }
  if (pointer === "/meta/id") {
    return "todo_game_id";
  }
  if (pointer === "/meta/playersMin" || pointer === "/meta/playersMax") {
    return 2;
  }
  if (pointer === "/actions") {
    return [{ kind: "TODO_ACTION", params: {} }];
  }
  if (pointer === "/end/kind") {
    return "turn_limit";
  }
  return "TODO_VALUE";
}
