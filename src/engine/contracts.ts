export type PlayerId = string;
export type Phase = string;
export type Stage = string | null;

export type State = object;

export interface Action<TType extends string = string, TPayload = unknown> {
  type: TType;
  actor: PlayerId;
  payload?: TPayload;
}

export interface RNG {
  readonly seed: string;
  readonly cursor: number;
  nextFloat(): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
  clone(): RNG;
}

export interface ReplayEvent<A extends Action = Action> {
  index: number;
  seed: string;
  turn: number;
  phase: Phase;
  actor: PlayerId;
  action: A;
  stateHashBefore: string;
  stateHashAfter: string;
  stage?: Stage;
}

export interface StepResult<S extends State = State, A extends Action = Action> {
  state: S;
  terminal: boolean;
  scores?: Record<PlayerId, number>;
  replayEvent: ReplayEvent<A>;
}
