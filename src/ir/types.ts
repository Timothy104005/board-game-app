import type { z } from "zod";
import { gameIRv0Schema } from "./schema.js";

export type GameIRv0 = z.infer<typeof gameIRv0Schema>;
export type GameIRActionSpec = GameIRv0["actions"][number];
export type GameIREndSpec = GameIRv0["end"];
export type GameIRScoringSpec = GameIRv0["scoring"];
