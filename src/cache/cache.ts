import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableHash } from "../utils/stableHash.js";

export interface EvaluationCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
}

export interface BuildEvaluationCacheKeyInput {
  irHash: string;
  seed: string;
  botsConfig: unknown;
  simConfig: unknown;
  codeVersion?: string;
}

export function createFileCache(input: { rootDir?: string } = {}): EvaluationCache {
  const rootDir = resolve(process.cwd(), input.rootDir ?? "artifacts/cache");
  mkdirSync(rootDir, { recursive: true });

  return {
    get<T>(key: string): T | null {
      const filePath = cacheFilePath(rootDir, key);
      if (!existsSync(filePath)) {
        return null;
      }
      try {
        return JSON.parse(readFileSync(filePath, "utf8")) as T;
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T): void {
      const filePath = cacheFilePath(rootDir, key);
      const tempPath = `${filePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(value)}\n`, "utf8");
      try {
        renameSync(tempPath, filePath);
      } catch {
        unlinkSync(tempPath);
        throw new Error(`failed to write cache entry '${key}'`);
      }
    }
  };
}

export function buildEvaluationCacheKey(input: BuildEvaluationCacheKeyInput): string {
  return stableHash({
    irHash: input.irHash,
    seed: input.seed,
    botsConfig: input.botsConfig,
    simConfig: input.simConfig,
    codeVersion: input.codeVersion
  });
}

export function resolveCodeVersion(): string | undefined {
  if (process.env.CODE_VERSION) {
    return process.env.CODE_VERSION;
  }
  try {
    const commit = execSync("git rev-parse --short HEAD", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return commit.length > 0 ? commit : undefined;
  } catch {
    return undefined;
  }
}

function cacheFilePath(rootDir: string, key: string): string {
  return resolve(rootDir, `${key}.json`);
}
