import { existsSync, mkdirSync, rmSync } from "node:fs";
import { getJobsRoot } from "../src/paths.js";

const jobsRoot = getJobsRoot();
if (existsSync(jobsRoot)) {
  rmSync(jobsRoot, { recursive: true, force: true });
}
mkdirSync(jobsRoot, { recursive: true });
console.log(`[jobs:reset] reset ${jobsRoot}`);
