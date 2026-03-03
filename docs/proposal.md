# 企劃書：Rulebook Compiler + Web MVP

本文是本 repo 的主企劃文件，描述目前已實作能力、可驗證範圍與後續路線。  
定位原則：文件內容必須與程式現況一致，並可由 `docs/evidence/*` 追溯。

## 0) 產品定義（使用者流程 1~7）

1. 使用者建立專案並提供規則來源（文字或 PDF）。
2. 系統將規則轉為標準化文字（PDF v0 僅文字抽取，不做 OCR）。
3. 產生 `irDraft`、`gaps`、`patchTemplate`。
4. 使用者可套用 patch 修補 IR。
5. 編譯 IR 成可執行 `GameModule`。
6. 以固定 seed 執行模擬，產生 replay 與 metrics。
7. 全部過程輸出至 artifacts，並可在 Web 頁面查詢 run 狀態與產物。

## 1) 範圍與非目標（v1 scope / out-of-scope）

### v1 Scope

- Rulebook（text/pdf）到 IR 的可重現流程。
- Checker + compiler + simulation 的一條龍執行鏈。
- Web MVP（專案、排程任務、查看 run/replay/artifacts）。
- Durable jobs（queue/store/worker）與 manifest/log 追蹤。
- 測試驗證（Vitest coverage、Playwright critical flow）。

### v1 Out-of-Scope

- OCR 與掃描型 PDF 辨識。
- 雲端多租戶、帳務、權限治理完整產品化。
- 即時協作編輯器與進階視覺化建模 UI。
- 執行期外部網路依賴（runtime 不依賴外部 API）。

## 2) 系統架構（A~G）

### A. 規則輸入層
- 文字規則：專案建立時直接輸入。
- PDF 規則：`/api/projects/[id]/upload-pdf` 上傳後由 worker 抽取文字。

### B. 規則抽取器
- 目前為 deterministic recognizers（`draftIRFromRulebookText` 等）。
- 未來可擴展 optional LLM extractor（非當前實作）。

### C. 遊戲 IR
- 採 IR v0 schema（Zod）與 checker 檢查。
- 產物包含 `ir`, `gaps`, `patchTemplate`。

### D. 引擎執行層
- `createInitialState / legalActions / applyAction / isTerminal / score`。
- 固定 seed + deterministic replay hash 驗證。

### E. Bot 層
- 已實作 `random`、`greedy`。
- 未來可擴展 MCTS / search bot。

### F. 敘事層
- 目前未實作（future）。
- 預留給自然語言解釋、教學摘要、賽局敘事化輸出。

### G. 模擬與分析層
- batch simulation、summary metrics、sample replay。
- 與 jobs/worker 結合輸出 manifest + artifacts。

## 3) 工具與技術棧

- Node.js + TypeScript
- Vitest + coverage provider v8
- Zod（IR schema validation）
- tsx（CLI scripts）
- Next.js App Router + Route Handlers（`apps/web`）
- Playwright（Web critical flow E2E）

## 4) 里程碑（M1~M5）

### M1：Engine Contract + Invariants
- Purpose：建立可重現的引擎契約與不變量檢查。
- Deliverables：engine contract、invariant gate、基礎遊戲執行模型。
- Acceptance criteria：
  - `npm test -- --coverage`
- Current status in this repo：
  - 已完成（`src/engine/*`, `src/games/*`）
  - 證據：[npm_test.txt](./evidence/npm_test.txt)

### M2：IR v0 + Compiler
- Purpose：建立 IR schema/checker/compile 主幹。
- Deliverables：IR v0 schema、checker、compiler、整合測試。
- Acceptance criteria：
  - `npm test -- --coverage`
  - `npm run rb:run:tictactoe`
- Current status in this repo：
  - 已完成（`src/ir/*`）
  - 證據：[npm_test.txt](./evidence/npm_test.txt)、[rb_run_tictactoe.txt](./evidence/rb_run_tictactoe.txt)

### M3：Rulebook Pipeline + Simulation
- Purpose：完成 rulebook 到模擬產物流程。
- Deliverables：`ir/gaps/patchTemplate/sim summary/replay` 輸出。
- Acceptance criteria：
  - `npm run rb:run:tictactoe`
  - `npm run rb:run:pig`
  - `npm run sim:tictactoe`
- Current status in this repo：
  - 已完成（`src/rulebook/*`, `src/sim/*`）
  - 證據：[rb_run_tictactoe.txt](./evidence/rb_run_tictactoe.txt)、[rb_run_pig.txt](./evidence/rb_run_pig.txt)、[sim_tictactoe.txt](./evidence/sim_tictactoe.txt)

### M4：Tuning + Restricted Patch Engine
- Purpose：以可控 patch 空間做 A/B 調參。
- Deliverables：tuner、objective、restricted patch ops、報告輸出。
- Acceptance criteria：
  - `npm test -- --coverage`
  - `npm run sim:splendor`
- Current status in this repo：
  - 已完成 v1 能力（`src/tuning/*`）
  - 證據：[npm_test.txt](./evidence/npm_test.txt)、[sim_splendor.txt](./evidence/sim_splendor.txt)

### M5：Productization（Web + Jobs）
- Purpose：提供可操作的 Web MVP 與耐久任務執行。
- Deliverables：Web 頁面、queue/store/worker、PDF ingestion、E2E、CI 分層。
- Acceptance criteria：
  - `npm test -- --coverage`
  - `cd apps/web && npm run build`
- Current status in this repo：
  - IN PROGRESS（核心流程可用，持續 hardening）
  - 證據：[npm_test.txt](./evidence/npm_test.txt)、[web_build.txt](./evidence/web_build.txt)、[git_log.txt](./evidence/git_log.txt)

## 5) IR v0 規格連結

- [IR v0 規格文件](./ir_v0.md)

## 6) 輸出規格（Artifacts）連結

- [Artifacts 輸出規格](./artifacts.md)

## 7) 風險與對策

- 規則文字語意不足：以 `gaps + patch` 形成人工校正閉環。
- 編譯與執行落差：以 checker + integration tests + invariants 交叉驗證。
- 非決定性漂移：固定 seed、固定流程、固定輸出結構。
- 任務中斷或佇列異常：durable store + recovery 邏輯 + manifest/log 可追蹤。
- PDF 品質不一：v0 僅保證可抽取文字 PDF，失敗時保留錯誤訊息。

## 8) Compliance / IP / Privacy 假設

- 使用者上傳內容僅用於本次專案執行，不做對外再散布。
- 專案目前以本機檔案流程為主，無執行期第三方外部資料傳輸。
- Artifacts 可能含使用者規則內容，需由部署方管理存取與保存週期。
- 後續待驗證項目：法務條款、資料保留政策、刪除請求流程、審計權限。

## Reality Check（企劃聲明 vs Repo 證據）

| Plan claim | Repo evidence | Status |
|---|---|---|
| Core test coverage 可執行 | [npm_test.txt](./evidence/npm_test.txt) | Done |
| 文字規則可跑完整 pipeline | [rb_run_tictactoe.txt](./evidence/rb_run_tictactoe.txt), [rb_run_pig.txt](./evidence/rb_run_pig.txt) | Done |
| 模擬指標可產生 | [sim_tictactoe.txt](./evidence/sim_tictactoe.txt), [sim_splendor.txt](./evidence/sim_splendor.txt) | Done |
| Web 可建置 | [web_build.txt](./evidence/web_build.txt) | Done |
| Durable jobs + Web productization 完成度 | [git_log.txt](./evidence/git_log.txt) | In progress |
| 合規流程（法務/刪除流程）制度化 | [git_status.txt](./evidence/git_status.txt) | In progress |
