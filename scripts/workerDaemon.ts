import { runWorkerDaemon } from "../src/jobs/worker.js";

const args = process.argv.slice(2);
const pollIntervalMs = parsePositiveInt(getArgValue(args, "--pollMs"), 500);
const maxParallelPoolSize = parsePositiveInt(getArgValue(args, "--pool"), 2);

console.log(`[jobs:worker] pollIntervalMs=${pollIntervalMs} maxParallelPoolSize=${maxParallelPoolSize}`);
runWorkerDaemon({
  pollIntervalMs,
  maxParallelPoolSize
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[jobs:worker] failed: ${message}`);
  process.exit(1);
});

function getArgValue(argsList: string[], flag: string): string | undefined {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
