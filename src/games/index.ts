import type { GameModule } from "./types.js";
import { splendorModule } from "./splendor/index.js";
import { tictactoeModule } from "./tictactoe/index.js";

export const gameModules: readonly GameModule[] = [tictactoeModule, splendorModule];

export const gameRegistry: Record<string, GameModule> = Object.fromEntries(
  gameModules.map((module) => [module.id, module])
) as Record<string, GameModule>;
