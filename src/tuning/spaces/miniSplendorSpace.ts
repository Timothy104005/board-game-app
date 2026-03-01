import { gameIRv0Schema } from "../../ir/schema.js";
import type { GameIRv0 } from "../../ir/types.js";
import type { CandidatePatch, PatchConstraintResult, PatchSpace } from "../patchSpace.js";

const NON_GOLD_COLORS = ["white", "blue", "green", "red", "black"] as const;

export const miniSplendorSpace: PatchSpace = {
  id: "mini_splendor",
  canHandle(ir: unknown): boolean {
    const parsed = gameIRv0Schema.safeParse(ir);
    if (!parsed.success) {
      return false;
    }
    const valid = parsed.data;
    const hasTake = valid.actions.some((action) => action.kind === "take_tokens");
    const hasBuy = valid.actions.some((action) => action.kind === "buy_card");
    const hasPool = Array.isArray(valid.state.public.cardPool);
    return hasTake && hasBuy && hasPool;
  },
  propose(seed: string, baseIr: unknown, count: number): CandidatePatch[] {
    const parsed = gameIRv0Schema.safeParse(baseIr);
    if (!parsed.success) {
      return [];
    }
    const valid = parsed.data;
    const cardPool = readCardPool(valid);
    const safeCount = Math.max(0, count);
    const rng = createLcg(seed);
    const out: CandidatePatch[] = [];

    for (let i = 0; i < safeCount; i += 1) {
      const tokenLimit = randInt(rng, 8, 12);
      const endScoreTarget = randInt(rng, 10, 20);
      const tweakCount = Math.min(cardPool.length, randInt(rng, 1, 2));

      const cardIndexes = pickUniqueIndexes(rng, cardPool.length, tweakCount);
      const ops: CandidatePatch["ops"] = [
        { op: "set", path: "/state/public/tokenLimit", value: tokenLimit },
        { op: "set", path: "/end", value: { kind: "score_at_least", target: endScoreTarget } }
      ];

      for (const cardIndex of cardIndexes) {
        const card = cardPool[cardIndex];
        if (!card) {
          continue;
        }

        const costColorKeys = Object.keys(card.cost).filter((color) =>
          NON_GOLD_COLORS.includes(color as (typeof NON_GOLD_COLORS)[number])
        );
        const selectedColor = costColorKeys.length > 0 ? costColorKeys[randInt(rng, 0, costColorKeys.length - 1)] : "white";

        const costDelta = randInt(rng, 0, 1) === 0 ? -1 : 1;
        const pointDelta = randInt(rng, 0, 1) === 0 ? -1 : 1;
        const currentCost = toNonNegativeInt(card.cost[selectedColor], 0);
        const currentPoints = toNonNegativeInt(card.points, 0);
        const nextCost = clamp(currentCost + costDelta, 0, 7);
        const nextPoints = clamp(currentPoints + pointDelta, 0, 5);

        ops.push({
          op: "set",
          path: `/state/public/cardPool/${cardIndex}/cost/${selectedColor}`,
          value: nextCost
        });
        ops.push({
          op: "set",
          path: `/state/public/cardPool/${cardIndex}/points`,
          value: nextPoints
        });
      }

      out.push({
        id: `mini_splendor_${i}`,
        ops,
        meta: {
          reason: "bounded token limit, target score, and card-value tuning",
          seed: `${seed}|${i}`,
          knobs: {
            tokenLimit,
            endScoreTarget,
            tweakedCards: cardIndexes
          }
        }
      });
    }

    return out;
  },
  constraints(baseIr: unknown, candidateIr: unknown): PatchConstraintResult {
    const errors: string[] = [];
    const baseParsed = gameIRv0Schema.safeParse(baseIr);
    const candidateParsed = gameIRv0Schema.safeParse(candidateIr);
    if (!baseParsed.success) {
      return { ok: false, errors: ["base IR is invalid."] };
    }
    if (!candidateParsed.success) {
      return { ok: false, errors: ["candidate IR is invalid."] };
    }

    const base = baseParsed.data;
    const candidate = candidateParsed.data;
    const baseCardPool = readCardPool(base);
    const candidateCardPool = readCardPool(candidate);

    if (baseCardPool.length !== candidateCardPool.length) {
      errors.push("cardPool size must remain unchanged.");
    }

    const tokenLimit = toNonNegativeInt(candidate.state.public.tokenLimit, -1);
    if (tokenLimit < 0) {
      errors.push("tokenLimit must be >= 0.");
    }

    if (candidate.end.kind === "score_at_least" && candidate.end.target < 1) {
      errors.push("score_at_least target must be >= 1.");
    }

    for (let i = 0; i < candidateCardPool.length; i += 1) {
      const card = candidateCardPool[i];
      const points = toNonNegativeInt(card.points, -1);
      if (points < 0 || points > 5) {
        errors.push(`cardPool[${i}].points must be within [0,5].`);
      }
      for (const color of Object.keys(card.cost)) {
        const cost = toNonNegativeInt(card.cost[color], -1);
        if (cost < 0 || cost > 7) {
          errors.push(`cardPool[${i}].cost.${color} must be within [0,7].`);
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors
    };
  }
};

interface SplendorCard {
  cost: Record<string, unknown>;
  points: unknown;
}

function readCardPool(ir: GameIRv0): SplendorCard[] {
  const raw = ir.state.public.cardPool;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is SplendorCard => typeof entry === "object" && entry !== null);
}

function createLcg(seed: string): { nextInt(minInclusive: number, maxInclusive: number): number } {
  let state = seedToUint32(seed);
  return {
    nextInt(minInclusive: number, maxInclusive: number): number {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive) || maxInclusive < minInclusive) {
        throw new Error("Invalid bounds for LCG nextInt.");
      }
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const span = maxInclusive - minInclusive + 1;
      return minInclusive + Math.floor((state / 0x100000000) * span);
    }
  };
}

function randInt(rng: { nextInt(minInclusive: number, maxInclusive: number): number }, min: number, max: number): number {
  return rng.nextInt(min, max);
}

function pickUniqueIndexes(
  rng: { nextInt(minInclusive: number, maxInclusive: number): number },
  size: number,
  count: number
): number[] {
  if (size <= 0 || count <= 0) {
    return [];
  }
  const indexes = [...Array(size).keys()];
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    const temp = indexes[i];
    indexes[i] = indexes[j];
    indexes[j] = temp;
  }
  return indexes.slice(0, count).sort((a, b) => a - b);
}

function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}
