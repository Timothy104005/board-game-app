import { z } from "zod";

const tictactoePlaceActionSchema = z.object({
  kind: z.literal("tictactoe_place"),
  params: z.object({
    x: z.array(z.number().int().min(0)).optional(),
    y: z.array(z.number().int().min(0)).optional()
  })
});

const takeTokensActionSchema = z.object({
  kind: z.literal("take_tokens"),
  params: z.object({
    colors: z.array(z.string()).min(1)
  })
});

const buyCardActionSchema = z.object({
  kind: z.literal("buy_card"),
  params: z.object({
    cardIds: z.array(z.string()).optional()
  })
});

const connect4DropActionSchema = z.object({
  kind: z.literal("connect4_drop"),
  params: z.object({
    columns: z.array(z.number().int().min(0)).optional()
  })
});

const takeFromPileActionSchema = z.object({
  kind: z.literal("take_from_pile"),
  params: z.object({
    minTake: z.number().int().positive(),
    maxTake: z.number().int().positive(),
    pileIndexes: z.array(z.number().int().min(0)).optional()
  })
});

const pigRollActionSchema = z.object({
  kind: z.literal("pig_roll"),
  params: z.object({})
});

const pigHoldActionSchema = z.object({
  kind: z.literal("pig_hold"),
  params: z.object({})
});

const actionSpecSchema = z.discriminatedUnion("kind", [
  tictactoePlaceActionSchema,
  takeTokensActionSchema,
  buyCardActionSchema,
  connect4DropActionSchema,
  takeFromPileActionSchema,
  pigRollActionSchema,
  pigHoldActionSchema
]);

const endSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("score_at_least"),
    target: z.number().int().nonnegative()
  }),
  z.object({
    kind: z.literal("turn_limit"),
    maxTurns: z.number().int().positive()
  }),
  z.object({
    kind: z.literal("never")
  })
]);

const scoringSchema = z.object({
  kind: z.union([z.literal("per_player_points"), z.literal("zero_sum")])
});

const resourceBoundRuleSchema = z.object({
  path: z.string().min(1),
  min: z.number(),
  max: z.number()
});

export const gameIRv0Schema = z.object({
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    playersMin: z.number().int().positive(),
    playersMax: z.number().int().positive()
  }),
  rng: z.object({
    seedable: z.literal(true)
  }),
  state: z.object({
    public: z.record(z.unknown()),
    players: z.record(z.record(z.unknown()))
  }),
  turn: z.object({
    order: z.literal("round_robin"),
    phases: z.array(z.string().min(1)).min(1)
  }),
  actions: z.array(actionSpecSchema).min(1),
  end: endSchema,
  scoring: scoringSchema,
  invariants: z
    .object({
      resourceBounds: z.array(resourceBoundRuleSchema).optional()
    })
    .optional()
});
