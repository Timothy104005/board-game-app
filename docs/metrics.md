# 指標規格（Metrics）

本文件區分「目前已實作」與「規劃中」指標，避免混淆。

## 1) 已實作指標（Current）

### 1.1 Win Rates

- 定義：各玩家（含和局）的勝率分佈。
- 來源：simulation summary。

### 1.2 Average Turns

- 定義：所有對局的平均回合數。
- 用途：判斷節奏是否過快或過慢。

### 1.3 Action Distribution

- 定義：各 action type 的出現比例。
- 用途：觀察策略多樣性與行為偏態。

### 1.4 Determinism Checks

- 定義：固定 seed 與固定輸入下，replay hash 與 aggregate metrics 應一致。
- 驗證：`src/sim/determinism.prop.test.ts`、相關 integration tests。

## 2) 規劃中指標（Planned）

### 2.1 First-Player Advantage

- 定義：先手玩家勝率相對其他玩家平均勝率的差值。
- 目的：評估座位公平性。

### 2.2 Strategy Concentration

- 定義：策略集中度（可用 action distribution 推導）。
- 目的：判斷是否出現單一路線主導。

## 3) 指標輸出位置

- CLI 模擬：`artifacts/replays/*.summary.json`
- Rulebook run：`artifacts/rulebook_run/*.sim.summary.json`
- Jobs run：`artifacts/jobs/<runId>/*.summary.json` 或 `artifacts/projects/<projectId>/runs/<runId>/*.summary.json`
