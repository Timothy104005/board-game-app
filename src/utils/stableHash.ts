import { createHash } from "node:crypto";
import { stableStringify } from "./stableJson.js";

export function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
