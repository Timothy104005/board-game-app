import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const jobsRoot = resolve(process.cwd(), "artifacts", "jobs");
if (existsSync(jobsRoot)) {
  rmSync(jobsRoot, { recursive: true, force: true });
}
mkdirSync(jobsRoot, { recursive: true });
console.log(`[jobs:reset] reset ${jobsRoot}`);
