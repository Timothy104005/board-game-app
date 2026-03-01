import type { IRPatchOperation } from "../ir/patch.js";
import type { CandidatePatch } from "./patchSpace.js";

export function toPatchOperations(
  ops: CandidatePatch["ops"]
): { ok: true; operations: IRPatchOperation[] } | { ok: false; error: string } {
  const operations: IRPatchOperation[] = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (op.op === "set") {
      operations.push({
        op: "set",
        path: op.path,
        value: op.value
      });
      continue;
    }
    if (op.op === "append") {
      operations.push({
        op: "append",
        path: op.path,
        value: op.value
      });
      continue;
    }
    if (!op.value || typeof op.value !== "object" || Array.isArray(op.value)) {
      return { ok: false, error: `invalid merge op at index ${i}` };
    }
    operations.push({
      op: "merge",
      path: op.path,
      value: op.value as Record<string, unknown>
    });
  }
  return { ok: true, operations };
}
