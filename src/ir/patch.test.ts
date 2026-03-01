import { describe, expect, it } from "vitest";
import { applyPatch, type IRPatch } from "./patch.js";

describe("IR patch operations", () => {
  it("applies set, append, and merge operations", () => {
    const draft = {
      meta: { name: "Old", id: "old_id" },
      actions: [{ kind: "tictactoe_place", params: {} }],
      state: {
        public: {
          boardSize: 3
        }
      }
    };

    const patch: IRPatch = {
      operations: [
        { op: "set", path: "/meta/name", value: "New Name" },
        { op: "append", path: "/actions", value: { kind: "pig_roll", params: {} } },
        { op: "merge", path: "/state/public", value: { tokenLimit: 10 } }
      ]
    };

    const result = applyPatch(draft, patch);
    const next = result.next as Record<string, unknown>;
    const meta = next.meta as Record<string, unknown>;
    const actions = next.actions as unknown[];
    const state = next.state as Record<string, unknown>;
    const publicState = state.public as Record<string, unknown>;

    expect(result.errors).toEqual([]);
    expect(result.appliedOps).toBe(3);
    expect(meta.name).toBe("New Name");
    expect(actions.length).toBe(2);
    expect(publicState.boardSize).toBe(3);
    expect(publicState.tokenLimit).toBe(10);
  });

  it("reports deterministic errors for invalid paths", () => {
    const draft = {
      meta: { name: "x" },
      actions: []
    };

    const patch: IRPatch = {
      operations: [
        { op: "set", path: "/meta/missing/value", value: 1 },
        { op: "append", path: "/meta/name", value: "x" },
        { op: "merge", path: "/actions/0", value: { x: 1 } }
      ]
    };

    const result = applyPatch(draft, patch);
    expect(result.appliedOps).toBe(0);
    expect(result.errors).toEqual([
      "operations[0]: path segment not found: 'missing'.",
      "operations[1]: append target is not an array.",
      "operations[2]: array index out of bounds: 0."
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const draft = {
      meta: { name: "Draft" },
      actions: []
    };

    const patch: IRPatch = {
      operations: [
        { op: "set", path: "/meta/name", value: "Updated" },
        { op: "append", path: "/actions", value: { kind: "pig_hold", params: {} } }
      ]
    };

    const first = applyPatch(draft, patch);
    const second = applyPatch(draft, patch);

    expect(first).toEqual(second);
  });
});
