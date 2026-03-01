export interface PatchOp {
  op: "set" | "merge" | "append";
  path: string;
  value: unknown;
}

export interface CandidatePatch {
  id: string;
  ops: PatchOp[];
  meta: {
    reason: string;
    seed: string;
    knobs: Record<string, unknown>;
  };
}

export interface PatchConstraintResult {
  ok: boolean;
  errors: string[];
}

export interface PatchSpace {
  id: string;
  canHandle(ir: unknown): boolean;
  propose(seed: string, baseIr: unknown, count: number): CandidatePatch[];
  constraints(baseIr: unknown, candidateIr: unknown): PatchConstraintResult;
}
