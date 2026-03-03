# 術語表

## IR（Intermediate Representation）
遊戲規則的中介資料格式。專案目前使用 IR v0，作為 `rulebook -> checker -> compiler -> simulate` 的共同語言。

## Checker
對 IR 進行靜態一致性檢查的模組，會產生 `errors` 與 `warnings`，避免不合法規則進入執行階段。

## Compiler
將 IR 轉成可執行 `GameModule` 的編譯器，對應引擎契約（`createInitialState`、`legalActions`、`applyAction`、`isTerminal`、`score`）。

## Invariant Gate
用於驗證執行安全與可重現性的守門條件，例如資源邊界、無死局、固定 seed 下結果一致。

## Replay
每步行為的可追溯記錄，包含回合、行為、狀態雜湊前後值，可用於除錯與重現。

## Job Queue
耐久化任務佇列（`projects.json`、`runs.json`、`queue.json`），由 worker 持續消化排隊任務。

## projectId / runId
專案與任務的單調遞增識別碼，格式分別為 `p000001`、`r000001`。

## Patch
對 IR 的受限修改操作集合，目前支援 `set`、`append`、`merge`。

## Tuner
以固定 seed 與目標函數在 patch 空間內搜尋較佳 IR 參數的模組，輸出 A/B 報告與最佳 patch。
