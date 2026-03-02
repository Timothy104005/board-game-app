# Web MVP Runbook

## Overview

M5 adds a Next.js dashboard (`apps/web`) and a durable root job system (`src/jobs/*`) for rulebook runs, patching, simulation, tuning, and replay browsing.

## Local Run (Two Terminals)

1. Terminal A (worker daemon):

```bash
npm run jobs:worker
```

2. Terminal B (web app):

```bash
cd apps/web
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Critical Flow

1. Open `/projects/new`.
2. Enter project name, seed, and rulebook text (or upload `.txt`).
3. Submit create form.
4. In `/projects/[id]`, click `Run Rulebook`.
5. Open run page and inspect gaps/IR artifacts.
6. From project page, click `Run Sim`.
7. Open replay link from `/runs/[runId]`.

## Data and Artifacts

- Jobs store and run outputs:
  - `artifacts/jobs/projects.json`
  - `artifacts/jobs/runs.json`
  - `artifacts/jobs/queue.json`
  - `artifacts/jobs/<runId>/manifest.json`
  - `artifacts/jobs/<runId>/logs.txt`
- Replay artifacts (via run manifests):
  - `artifacts/jobs/<runId>/*.replay*.json`
- Tuning/report outputs (via run manifests):
  - `artifacts/jobs/<runId>/tune.report.md`
  - `artifacts/jobs/<runId>/tune.report.json`
  - `artifacts/jobs/<runId>/tune.best.ir.json`

## Troubleshooting

- Queue stuck in `queued`:
  - verify worker daemon is running: `npm run jobs:worker`
  - check `artifacts/jobs/queue.json`
  - inspect `artifacts/jobs/<runId>/logs.txt`
- Lock contention:
  - check and remove stale `artifacts/jobs/store.lock` if daemon is stopped
  - restart worker daemon
- Reset jobs state:
  - `npm run jobs:reset`
- Missing replay link:
  - run `Run Sim` after `Run Rulebook`
  - then open the latest simulation run
