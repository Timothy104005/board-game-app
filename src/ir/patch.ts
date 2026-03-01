export interface PatchOpSet {
  op: "set";
  path: string;
  value: unknown;
}

export interface PatchOpAppend {
  op: "append";
  path: string;
  value: unknown;
}

export interface PatchOpMerge {
  op: "merge";
  path: string;
  value: Record<string, unknown>;
}

export type IRPatchOperation = PatchOpSet | PatchOpAppend | PatchOpMerge;

export interface IRPatch {
  operations: IRPatchOperation[];
}

export interface ApplyPatchResult {
  next: unknown;
  appliedOps: number;
  errors: string[];
}

export function applyPatch(irDraft: unknown, patch: IRPatch): ApplyPatchResult {
  const errors: string[] = [];
  const next = deepClone(irDraft);

  if (!patch || typeof patch !== "object" || !Array.isArray(patch.operations)) {
    return {
      next,
      appliedOps: 0,
      errors: ["patch must be an object with an operations array."]
    };
  }

  let appliedOps = 0;
  for (let i = 0; i < patch.operations.length; i += 1) {
    const operation = patch.operations[i];
    const operationErrors = applyOperation(next, operation);
    if (operationErrors.length > 0) {
      for (const error of operationErrors) {
        errors.push(`operations[${i}]: ${error}`);
      }
      continue;
    }
    appliedOps += 1;
  }

  return { next, appliedOps, errors };
}

function applyOperation(root: unknown, operation: IRPatchOperation): string[] {
  const pathSegmentsResult = parsePath(operation.path);
  if (!pathSegmentsResult.ok) {
    return [pathSegmentsResult.error];
  }
  const segments = pathSegmentsResult.segments;

  if (operation.op === "set") {
    return applySet(root, segments, operation.value);
  }
  if (operation.op === "append") {
    return applyAppend(root, segments, operation.value);
  }
  return applyMerge(root, segments, operation.value);
}

function applySet(root: unknown, segments: string[], value: unknown): string[] {
  if (segments.length === 0) {
    return ["cannot set root value directly."];
  }

  const parentResult = resolveParent(root, segments);
  if (!parentResult.ok) {
    return [parentResult.error];
  }

  const { parent, key } = parentResult;
  if (Array.isArray(parent)) {
    const index = parseArrayIndex(key);
    if (index === null) {
      return [`array index must be an integer, got '${key}'.`];
    }
    if (index < 0 || index >= parent.length) {
      return [`array index out of bounds: ${index}.`];
    }
    parent[index] = value;
    return [];
  }

  parent[key] = value;
  return [];
}

function applyAppend(root: unknown, segments: string[], value: unknown): string[] {
  const targetResult = resolveTarget(root, segments);
  if (!targetResult.ok) {
    return [targetResult.error];
  }
  if (!Array.isArray(targetResult.target)) {
    return ["append target is not an array."];
  }
  targetResult.target.push(value);
  return [];
}

function applyMerge(root: unknown, segments: string[], value: Record<string, unknown>): string[] {
  if (!isPlainObject(value)) {
    return ["merge value must be a plain object."];
  }

  const targetResult = resolveTarget(root, segments);
  if (!targetResult.ok) {
    return [targetResult.error];
  }
  if (!isPlainObject(targetResult.target)) {
    return ["merge target is not an object."];
  }

  Object.assign(targetResult.target, value);
  return [];
}

function parsePath(path: string): { ok: true; segments: string[] } | { ok: false; error: string } {
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "path must be a non-empty string." };
  }
  if (path === "/") {
    return { ok: true, segments: [] };
  }
  if (!path.startsWith("/")) {
    return { ok: false, error: "path must start with '/'." };
  }

  const rawSegments = path
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  return { ok: true, segments: rawSegments };
}

function resolveParent(
  root: unknown,
  segments: string[]
): { ok: true; parent: Record<string, unknown> | unknown[]; key: string } | { ok: false; error: string } {
  if (segments.length === 0) {
    return { ok: false, error: "path does not include a target key." };
  }

  const key = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);
  const targetResult = resolveTarget(root, parentSegments);
  if (!targetResult.ok) {
    return { ok: false, error: targetResult.error };
  }

  const parent = targetResult.target;
  if (!Array.isArray(parent) && !isRecord(parent)) {
    return { ok: false, error: "target parent is neither object nor array." };
  }

  return { ok: true, parent, key };
}

function resolveTarget(root: unknown, segments: string[]): { ok: true; target: unknown } | { ok: false; error: string } {
  let current: unknown = root;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(segment);
      if (index === null) {
        return { ok: false, error: `array index must be an integer, got '${segment}'.` };
      }
      if (index < 0 || index >= current.length) {
        return { ok: false, error: `array index out of bounds: ${index}.` };
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return { ok: false, error: `cannot descend into non-object at segment '${segment}'.` };
    }
    if (!(segment in current)) {
      return { ok: false, error: `path segment not found: '${segment}'.` };
    }
    current = current[segment];
  }

  return { ok: true, target: current };
}

function parseArrayIndex(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
