# Web MVP Runbook

## Overview

M5 提供 Next.js Dashboard (`apps/web`) 與耐久化任務系統 (`src/jobs/*`)，支援 rulebook run、apply patch、simulate、tune、replay 檢視。

## Local Run (Two Terminals)

1. Terminal A (Worker Daemon):

```bash
npm run jobs:worker
```

2. Terminal B (Web App):

```bash
cd apps/web
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## MVP Critical Flow

1. 打開 `/projects/new` 建立專案 (貼上規則文字)。
2. 在 `/projects/[id]` 按 `Run Rulebook`。
3. 進入 `/runs/[runId]`，確認 `succeeded`，查看 `ir` 與 `gaps`。
4. 回到專案頁，貼上 patch JSON，按 `Apply Patch`。
5. patch run 成功後，回到專案頁按 `Run Sim`。
6. 在 run 頁面點 `open replay`，確認 replay steps 可瀏覽。

## Data and Artifacts

- Jobs store:
  - `artifacts/jobs/projects.json`
  - `artifacts/jobs/runs.json`
  - `artifacts/jobs/queue.json`
- Per-run outputs:
  - `artifacts/jobs/<runId>/manifest.json`
  - `artifacts/jobs/<runId>/logs.txt`
  - `artifacts/jobs/<runId>/*.json` (IR/gaps/replay/sim/tune outputs)
- Schoolday verify outputs:
  - `artifacts/schoolday/<timestamp>/summary.json`
- Tuning artifacts (from tune runs):
  - `artifacts/jobs/<runId>/tune.report.md`
  - `artifacts/jobs/<runId>/tune.report.json`
  - `artifacts/jobs/<runId>/tune.best.ir.json`

## Troubleshooting

1. Queue 一直停在 `queued`:
   - 確認 Worker 正在跑: `npm run jobs:worker`
   - 檢查 `artifacts/jobs/queue.json` 是否有 run id
   - 查看 `artifacts/jobs/<runId>/logs.txt`
2. Worker 啟動後立即退出:
   - 是否誤用了 `--once`；持續背景模式不要帶 `--once`
3. Lock 卡住:
   - 停掉 worker 後檢查 `artifacts/jobs/store.lock`
   - 再重啟 worker (store 會自動處理 stale lock)
4. Replay 連結不存在:
   - 先完成 `Run Sim`，成功後 run artifacts 才會有 replay
5. 快速健康檢查:
   - `npm run jobs:smoke`
