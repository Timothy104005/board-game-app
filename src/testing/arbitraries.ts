import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import type { IRPatchOperation } from "../ir/patch.js";

function loadFixture(name: string): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", name);
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

const miniSplendorBase = loadFixture("mini_splendor.ir.json");
const tictactoeBase = loadFixture("tictactoe.ir.json");

export const seedArbitrary = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((seed) => seed.replace(/[^a-zA-Z0-9_-]/g, "_"))
  .filter((seed) => seed.length > 0);

export const irVariantArbitrary = fc.oneof(
  fc
    .record({
      tokenLimit: fc.integer({ min: 8, max: 12 }),
      maxTurns: fc.integer({ min: 30, max: 120 })
    })
    .map((input) => {
      const next = deepClone(miniSplendorBase);
      next.state.public.tokenLimit = input.tokenLimit;
      next.end = {
        kind: "turn_limit",
        maxTurns: input.maxTurns
      };
      return next;
    }),
  fc
    .record({
      maxTurns: fc.integer({ min: 5, max: 12 })
    })
    .map((input) => {
      const next = deepClone(tictactoeBase);
      next.end = {
        kind: "turn_limit",
        maxTurns: input.maxTurns
      };
      return next;
    })
);

const setPatchArbitrary = fc.oneof(
  fc.integer({ min: 8, max: 12 }).map<IRPatchOperation>((value) => ({
    op: "set",
    path: "/state/public/tokenLimit",
    value
  })),
  fc.integer({ min: 20, max: 120 }).map<IRPatchOperation>((value) => ({
    op: "set",
    path: "/end/maxTurns",
    value
  }))
);

const mergePatchArbitrary = fc.record({
  tokenLimit: fc.integer({ min: 8, max: 12 })
}).map<IRPatchOperation>((value) => ({
  op: "merge",
  path: "/state/public",
  value
}));

const appendPatchArbitrary = fc.constantFrom<IRPatchOperation>(
  {
    op: "append",
    path: "/actions",
    value: {
      kind: "pig_roll",
      params: {}
    }
  },
  {
    op: "append",
    path: "/actions",
    value: {
      kind: "pig_hold",
      params: {}
    }
  }
);

export const patchOperationsArbitrary = fc.array(fc.oneof(setPatchArbitrary, mergePatchArbitrary, appendPatchArbitrary), {
  minLength: 1,
  maxLength: 4
});

export const shortActionSequenceArbitrary = fc.array(
  fc.constantFrom(
    { type: "tictactoe_place", actor: "0", payload: { x: 0, y: 0 } },
    { type: "tictactoe_place", actor: "1", payload: { x: 1, y: 0 } },
    { type: "tictactoe_place", actor: "0", payload: { x: 2, y: 0 } },
    { type: "tictactoe_place", actor: "1", payload: { x: 0, y: 1 } },
    { type: "tictactoe_place", actor: "0", payload: { x: 1, y: 1 } }
  ),
  { minLength: 0, maxLength: 6 }
);

export const rulebookTextArbitrary = fc.array(fc.string({ minLength: 0, maxLength: 60 }), {
  minLength: 1,
  maxLength: 8
}).map((lines) => lines.join("\n"));

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
