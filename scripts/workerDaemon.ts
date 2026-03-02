import { runWorkerDaemon, type WorkerEvent } from "../src/jobs/worker.js";

const args = process.argv.slice(2);
const pollIntervalMs = parsePositiveInt(getArgValue(args, "--pollMs"), 500);
const maxParallelPoolSize = parsePositiveInt(getArgValue(args, "--pool"), 2);
const once = args.includes("--once");

const abortController = new AbortController();
process.once("SIGINT", () => abortController.abort());
process.once("SIGTERM", () => abortController.abort());

log({
  level: "info",
  event: "worker_boot",
  pollIntervalMs,
  maxParallelPoolSize,
  once
});

runWorkerDaemon({
  pollIntervalMs,
  maxParallelPoolSize,
  once,
  signal: abortController.signal,
  onEvent: (event) => log(event)
})
  .then(() => {
    log({
      level: "info",
      event: "worker_exit",
      code: 0
    });
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log({
      level: "error",
      event: "worker_exit",
      code: 1,
      message
    });
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

function log(event: WorkerEvent | Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
}
