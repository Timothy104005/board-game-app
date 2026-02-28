import { expect } from "vitest";
import type { Action, PlayerId, RNG, State, StepResult } from "./contracts.js";

export interface EngineForInvariants<S extends State, A extends Action> {
  legalActions(state: S): A[];
  applyAction(state: S, action: A, rng: RNG): StepResult<S, A>;
  isTerminal(state: S): boolean;
  score(state: S): Record<PlayerId, number>;
}

export interface NoDeadEndOptions {
  seed?: string;
  maxDepth?: number;
}

export interface ResourceBoundRule {
  path: string;
  min: number;
  max: number;
}

export interface ResourceBoundConfig {
  rules: ResourceBoundRule[];
}

interface SequenceRunResult {
  finalStateHash: string;
  finalScore: Record<PlayerId, number>;
  replayEventHashes: string[];
}

const DEFAULT_NO_DEAD_END_MAX_DEPTH = 8;

export function assertNoDeadEnd<S extends State, A extends Action>(
  engine: EngineForInvariants<S, A>,
  initState: (seed: string) => S,
  options: NoDeadEndOptions = {}
): void {
  const seed = options.seed ?? "invariant-no-dead-end";
  const maxDepth = options.maxDepth ?? DEFAULT_NO_DEAD_END_MAX_DEPTH;
  const reachableStates = enumerateReachableStates(engine, initState, seed, maxDepth);

  for (const state of reachableStates) {
    if (!engine.isTerminal(state)) {
      expect(engine.legalActions(state).length).toBeGreaterThan(0);
    }
  }
}

export function assertDeterminism<S extends State, A extends Action>(
  engine: EngineForInvariants<S, A>,
  initState: (seed: string) => S,
  actions: readonly A[],
  seed: string
): void {
  const runA = runActionSequence(engine, initState, seed, actions);
  const runB = runActionSequence(engine, initState, seed, actions);

  expect(runA.finalStateHash).toBe(runB.finalStateHash);
  expect(runA.finalScore).toEqual(runB.finalScore);
  expect(runA.replayEventHashes).toEqual(runB.replayEventHashes);
}

export function assertResourceBounds<S extends State, A extends Action>(
  _engine: EngineForInvariants<S, A>,
  state: S,
  config: ResourceBoundConfig
): void {
  for (const rule of config.rules) {
    const values = collectPathValues(state, rule.path);
    expect(values.length).toBeGreaterThan(0);

    for (const value of values) {
      expect(typeof value).toBe("number");
      const numericValue = value as number;
      expect(numericValue).toBeGreaterThanOrEqual(rule.min);
      expect(numericValue).toBeLessThanOrEqual(rule.max);
    }
  }
}

export class LcgRng implements RNG {
  public readonly seed: string;
  private state: number;
  private cursorValue: number;

  public constructor(seed: string, state?: number, cursor = 0) {
    this.seed = seed;
    this.state = state ?? seedToUint32(seed);
    this.cursorValue = cursor;
  }

  public get cursor(): number {
    return this.cursorValue;
  }

  public nextFloat(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    this.cursorValue += 1;
    return this.state / 0x100000000;
  }

  public nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive) || maxInclusive < minInclusive) {
      throw new Error("nextInt expects integer bounds with maxInclusive >= minInclusive.");
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * span);
  }

  public clone(): RNG {
    return new LcgRng(this.seed, this.state, this.cursorValue);
  }
}

function enumerateReachableStates<S extends State, A extends Action>(
  engine: EngineForInvariants<S, A>,
  initState: (seed: string) => S,
  seed: string,
  maxDepth: number
): S[] {
  const start = initState(seed);
  const reachable: S[] = [];
  const queue: Array<{ state: S; depth: number }> = [{ state: start, depth: 0 }];
  const visited = new Set<string>([stableHash(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    reachable.push(current.state);
    if (current.depth >= maxDepth || engine.isTerminal(current.state)) {
      continue;
    }

    const stateHash = stableHash(current.state);
    const actions = engine.legalActions(current.state);
    for (let i = 0; i < actions.length; i += 1) {
      const action = actions[i];
      const branchSeed = `${seed}|${current.depth}|${i}|${stateHash}|${stableHash(action)}`;
      const branchRng = new LcgRng(branchSeed);
      const step = engine.applyAction(current.state, action, branchRng);
      const nextHash = stableHash(step.state);

      if (!visited.has(nextHash)) {
        visited.add(nextHash);
        queue.push({ state: step.state, depth: current.depth + 1 });
      }
    }
  }

  return reachable;
}

function runActionSequence<S extends State, A extends Action>(
  engine: EngineForInvariants<S, A>,
  initState: (seed: string) => S,
  seed: string,
  actions: readonly A[]
): SequenceRunResult {
  let state = initState(seed);
  const rng = new LcgRng(seed);
  const replayEventHashes: string[] = [];

  for (let i = 0; i < actions.length; i += 1) {
    if (engine.isTerminal(state)) {
      break;
    }

    const expectedAction = actions[i];
    const legal = engine.legalActions(state);
    const expectedHash = stableHash(expectedAction);
    const concreteAction = legal.find((candidate) => stableHash(candidate) === expectedHash);
    if (!concreteAction) {
      throw new Error(`Determinism sequence contains illegal action at index ${i}.`);
    }

    const step = engine.applyAction(state, concreteAction, rng);
    replayEventHashes.push(stableHash(step.replayEvent));
    state = step.state;
  }

  return {
    finalStateHash: stableHash(state),
    finalScore: engine.score(state),
    replayEventHashes
  };
}

function collectPathValues(root: unknown, path: string): unknown[] {
  const segments = path.split(".").filter((segment) => segment.length > 0);
  return resolvePathSegments([root], segments);
}

function resolvePathSegments(nodes: unknown[], segments: string[]): unknown[] {
  if (segments.length === 0) {
    return nodes;
  }

  const [head, ...rest] = segments;
  const nextNodes: unknown[] = [];

  for (const node of nodes) {
    if (head === "*") {
      if (Array.isArray(node)) {
        nextNodes.push(...node);
      } else if (node && typeof node === "object") {
        nextNodes.push(...Object.values(node as Record<string, unknown>));
      }
      continue;
    }

    if (node && typeof node === "object" && head in (node as Record<string, unknown>)) {
      nextNodes.push((node as Record<string, unknown>)[head]);
    }
  }

  return resolvePathSegments(nextNodes, rest);
}

function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return '"__undefined__"';
  }
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",");
  return `{${body}}`;
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
