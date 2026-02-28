import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIR } from "./checker.js";
import { gameIRv0Schema } from "./schema.js";

function loadFixture(name: string): unknown {
  const fullPath = resolve(process.cwd(), "src", "ir", "examples", name);
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

describe("IR v0", () => {
  it("parses tictactoe fixture", () => {
    const fixture = loadFixture("tictactoe.ir.json");
    const parsed = gameIRv0Schema.parse(fixture);
    expect(parsed.meta.id).toBe("tictactoe_ir");
  });

  it("parses mini splendor fixture", () => {
    const fixture = loadFixture("mini_splendor.ir.json");
    const parsed = gameIRv0Schema.parse(fixture);
    expect(parsed.meta.id).toBe("mini_splendor_ir");
  });

  it("checker returns no errors on fixtures", () => {
    const ttt = loadFixture("tictactoe.ir.json");
    const splendor = loadFixture("mini_splendor.ir.json");

    expect(checkIR(ttt).errors).toEqual([]);
    expect(checkIR(splendor).errors).toEqual([]);
  });

  it("checker returns errors for invalid payload", () => {
    const broken = {
      meta: { id: "", name: "", playersMin: 2 },
      actions: []
    };

    const result = checkIR(broken);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
