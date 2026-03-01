import { describe, expect, it } from "vitest";
import { stableHash } from "./stableHash.js";
import { stableStringify } from "./stableJson.js";

describe("stable hash", () => {
  it("is key-order insensitive for objects", () => {
    const a = {
      top: "value",
      nested: {
        b: 2,
        a: 1
      }
    };
    const b = {
      nested: {
        a: 1,
        b: 2
      },
      top: "value"
    };

    expect(stableHash(a)).toBe(stableHash(b));
  });

  it("is deterministic across repeated calls", () => {
    const value = {
      arr: [3, 2, 1],
      deep: {
        x: true,
        y: null,
        z: undefined
      }
    };

    const first = stableHash(value);
    const second = stableHash(value);
    const third = stableHash(JSON.parse(stableStringify(value)));

    expect(first).toBe(second);
    expect(first).toBe(third);
  });
});
