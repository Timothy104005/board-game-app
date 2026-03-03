# 專案現況摘要

## 1) 已具備能力

- Rulebook（text/pdf）可進入 IR pipeline，產出 `irDraft`、`gaps`、`patchTemplate`。
- IR 可編譯成 `GameModule` 並執行 deterministic 模擬。
- Web MVP 可建立專案、觸發任務、查看 run 狀態與 replay。
- Jobs/worker 採耐久化 queue/store，run 皆有 manifest 與 logs。

## 2) 目前驗證命令

- `npm test -- --coverage`
- `npm run sim:tictactoe`
- `npm run sim:splendor`
- `npm run rb:run:tictactoe`
- `npm run rb:run:pig`
- `cd apps/web && npm run build`

## 3) 決定性聲明

在固定 seed 與固定輸入下，核心流程結果可重現，並可由 artifacts 與 replay 進行追溯。  
相關驗證已納入測試與腳本流程。
