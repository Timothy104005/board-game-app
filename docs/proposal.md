# 提案書 (Rulebook Compiler Front-End)

## 0) 產品流程 (目標流程 1~7)

1. 使用者提供自然語言規則文件 (rulebook)。
2. 系統做正規化與段落/訊號抽取。
3. 產生 `irDraft`、`gaps`、`patchTemplate`。
4. 人工審查 gap 並用 patch 修補 IR。
5. 將 IR 編譯成可執行 `GameModule`。
6. 以固定 seed 與 bots 跑模擬，輸出 replay 與 metrics。
7. 所有結果寫入 artifacts，提供可追溯與可重跑能力。

## 1) 產品範圍 (v1 scope / v1 out-of-scope)

**v1 Scope**

- 規則文字與 PDF 文字抽取 -> IR 草稿，且流程可重現 (deterministic)。
- 產出 gap report 與 patch template (可人工修補)。
- IR -> compiler -> 模擬，並輸出 replay/metrics。
- Invariant gate 與 determinism 檢查。
- CLI 與本地 artifacts 工作流。

**v1 Out-of-Scope**

- 完整商業化帳務與多租戶隔離。
- 對外 LLM 雲端 API 依賴。
- 複雜視覺化編輯器 (v1 以 CLI 與基本 Web MVP 為主)。
- 分散式叢集排程與跨區部署。
- OCR (v0 PDF ingestion 僅處理可抽取文字 PDF)。

## 2) 系統組件 (A~G: 輸入/解析/IR/編譯/Bot/模擬/產物)

A. **規則輸入層**: rulebook 原始文字，或 PDF 上傳後的抽取文字 (v0 不做 OCR)。  
B. **解析層**: normalize / segment / extractSignals。  
C. **IR 層**: draftIR、schema/checker、gap report、patch template。  
D. **編譯層**: compileToGameModule + engine contract (initial/legal/apply/terminal/score)。  
E. **Bot 層**: random / greedy 策略，固定 seed。  
F. **模擬層**: replay event (action + state hash)。  
G. **產物層**: runMatch/runBatch，輸出 summary 與 artifacts。  

## 3) 技術選型 (核心 + 後續 Next.js 擴展)

**核心 (已落地)**

- Node.js + TypeScript
- Vitest + coverage
- Zod (IR schema 驗證)
- tsx (CLI script 執行)

**產品化 (進行中)**

- Next.js (Web Dashboard + Server Actions/Route Handlers)
- Worker/Queue (耐久化背景任務)
- PDF 文字抽取 (pdf-parse)

## 4) 里程碑規劃 (Milestone 1~5)

### Milestone 1 (DONE)

- Purpose: 建立引擎契約與不變量守護。
- Deliverables: engine contract、invariantGate、可重現執行模型。
- Acceptance criteria:
  - `npm test -- --coverage`
- Current status in this repo: 已完成 (`src/engine/*`, `src/games/*`)。

### Milestone 2 (DONE)

- Purpose: 建立 IR v0 與 compiler 主幹。
- Deliverables: `schema.ts`, `checker.ts`, `compileToGameModule.ts`。
- Acceptance criteria:
  - `npm test -- --coverage`
- Current status in this repo: 已完成且有 integration tests (`src/ir/*`)。

### Milestone 3 (DONE)

- Purpose: 完成 rulebook -> IR -> compile -> simulate 主流程。
- Deliverables: rulebook pipeline、gaps/patch template、`rb:run:*` scripts。
- Acceptance criteria:
  - `npm run rb:run:tictactoe`
  - `npm run rb:run:pig`
- Current status in this repo: 已完成，含 golden 與 determinism 驗證 (`src/rulebook/*`, `src/sim/*`)。

### Milestone 4 (DONE)

- Purpose: 補強調參與受限 patch engine。
- Deliverables: tuning objective、A/B 指標比較、受限 patch 操作。
- Acceptance criteria:
  - `npm test -- --coverage`
  - 固定 seed 下 before/after 可比較
- Current status in this repo: 已完成基礎能力，持續擴展搜尋空間與門檻。

### Milestone 5 (IN PROGRESS)

- Purpose: 產品化 Web SaaS MVP 與可維運工作流。
- Deliverables: Web UI + Durable Jobs + Worker + E2E + CI 分層 + PDF ingestion。
- Acceptance criteria:
  - 任務可追蹤狀態與 artifacts。
  - replay 與 run logs 可在 Web 檢視。
  - PDF 上傳 -> 抽取文字 -> rulebook run 可在 UI 完成。
- Current status in this repo: 進行中，已具備端到端 MVP，持續 hardening。

## 5) 參考定義: Game IR v0

目前 IR 與 action 規格請參考:

- [Game IR v0 文件](./ir_v0.md)

## 6) 產物格式: Replay / Metrics / Gap report / Patch template

### Replay event (示例)

```json
{
  "index": 3,
  "seed": "demo-seed",
  "turn": 4,
  "actor": "0",
  "action": { "type": "tictactoe_place", "payload": { "x": 1, "y": 1 } },
  "stateHashBefore": "3ab1f2de",
  "stateHashAfter": "24bc9ad1"
}
```

### Simulation summary (示例)

```json
{
  "matches": 20,
  "winRates": { "0": 0.55, "1": 0.35, "draw": 0.1 },
  "averageTurns": 7.8,
  "actionDistribution": { "tictactoe_place": 1 }
}
```

### Gap report (示例)

```json
{
  "summary": { "errors": 2, "warnings": 1 },
  "gaps": [
    { "filePointer": "/actions", "severity": "error", "message": "actions: Array must contain at least 1 element(s)" }
  ]
}
```

### Patch template (示例)

```json
{
  "patchTemplate": {
    "operations": [
      { "op": "set", "path": "/meta/name", "value": "TODO_NAME" },
      { "op": "set", "path": "/actions", "value": [{ "kind": "TODO_ACTION", "params": {} }] }
    ]
  }
}
```

## 7) 風險與對策

- **規則語意不完整**: 文本可能缺條件或例外。  
  對策: 以 gap + patch 人工閉環，避免直接自動上線。
- **編譯/執行不一致**: schema/checker 與 runtime 行為偏移。  
  對策: checker、integration tests 與 invariant gate 並行把關。
- **隨機性導致不可重現**: 測試與模擬結果漂移。  
  對策: 固定 seed + 固定 bot 組合 + 回放 hash 驗證。
- **patch 失控**: 任意 patch 可能破壞 IR。  
  對策: 僅允許 `set/append/merge`，並在 checker/compile 前後驗證。
- **PDF 品質差異**: 掃描型文件可能無法抽取文字。  
  對策: v0 僅支援可抽取文字 PDF，抽取失敗會保留錯誤訊息並產生可追蹤輸出。

## 8) 成功指標 / 非目標 / 未來

**成功指標**

- 固定輸入可重跑出一致結果與可追溯 artifacts。
- Web 端可完成「上傳 PDF -> 跑任務 -> 看 IR/gaps/replay」。

**非目標 (目前階段)**

- 即時多人協作編輯。
- 跨雲地區高可用部署。
- 完整商務與合規治理。

**未來方向**

- 更完整的資料治理與審計流程。
- 更強的 IR lint 與 patch 建議能力。
- 可控的多工作者擴展策略。
- 部署與權限模型標準化。

## M5 補充證據與架構備註 (2026-03-03)

### 已實作範圍

- `apps/web` Next.js App Router 儀表板:
  - `/` 專案列表
  - `/projects/new` 建專案 (貼上/上傳 rulebook)
  - `/projects/[id]` 任務控制、PDF 上傳、最近 runs、gap/patch 預覽
  - `/runs/[runId]` 狀態輪詢、logs tail、artifact links
  - `/replays/[replayId]` step 導航與差異檢視
- `src/jobs/*` 耐久化任務系統:
  - `projects.json`, `runs.json`, `queue.json`
  - run artifacts/log/manifest 輸出
- PDF ingestion:
  - `POST /api/projects/[id]/upload-pdf`
  - `rulebook_run_pdf` 任務將 PDF 抽取文字後走同一條 rulebook pipeline
  - 輸出 `rulebook.extracted.txt`, `rulebook.ir.json`, `rulebook.gaps.json`, `rulebook.patch.template.json`, `rulebook.replay.sample.json`

### 可重現與可追溯性

- 預設 seed 維持 `"42"`。
- 任務 ID 採單調遞增 (`p000001`, `r000001`)。
- 每次 run 皆寫入 `manifest.json` 與 `logs.txt`。
- PDF manifest 會記錄 `sourceType=pdf`, `uploadId`, `pdfSha256`。

### M5 證據命令

1. `npm test -- --coverage`
2. `npm run jobs:worker`
3. `cd apps/web && npm run dev`
4. 在 UI 執行 PDF 上傳 -> Run from PDF -> 檢視 IR/gaps/replay
5. `cd apps/web && npm test -- --grep "critical flow"`
6. `npm run jobs:smoke`
