import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGreedyBot } from "../src/bots/greedyBot.js";
import { createRandomBot } from "../src/bots/randomBot.js";
import { gameRegistry } from "../src/games/index.js";
import { runBatch } from "../src/sim/runBatch.js";

const gameId = process.argv[2] ?? "tictactoe";
const seed = process.argv[3] ?? `${gameId}-seed`;
const matches = parsePositiveInt(process.argv[4], 20);
const maxTurns = parsePositiveInt(process.argv[5], gameId === "tictactoe" ? 16 : 64);

const game = gameRegistry[gameId];
if (!game) {
  throw new Error(`Unknown game id: ${gameId}`);
}

const bots = {
  "0": createGreedyBot("greedy"),
  "1": createRandomBot("random")
};

const batch = runBatch({
  game,
  bots,
  seed,
  matches,
  maxTurns
});

const outputDir = resolve(process.cwd(), "artifacts", "replays");
mkdirSync(outputDir, { recursive: true });
const replayFile = resolve(outputDir, `${gameId}-${seed.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
writeFileSync(
  replayFile,
  JSON.stringify(
    {
      gameId,
      seed,
      matches,
      maxTurns,
      metrics: batch.metrics,
      firstReplay: batch.matches[0]?.replayLog ?? []
    },
    null,
    2
  )
);

console.log(`[sim] game=${gameId} matches=${matches} seed=${seed}`);
console.log(`[sim] winRates=${JSON.stringify(batch.metrics.winRates)}`);
console.log(`[sim] averageTurns=${batch.metrics.averageTurns.toFixed(2)}`);
console.log(`[sim] actionDistribution=${JSON.stringify(batch.metrics.actionDistribution)}`);
console.log(`[sim] replay=${replayFile}`);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
