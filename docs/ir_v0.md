# IR v0 規格

本文件對應 `src/ir/schema.ts`、`src/ir/checker.ts`、`src/ir/compileToGameModule.ts` 的目前實作。

## 1) Schema 概觀（必要欄位）

IR v0 的主要結構：

- `meta`
  - `id`, `name`, `playersMin`, `playersMax`
- `rng`
  - `seedable`
- `state`
  - `public`
  - `players`
- `turn`
  - `order`, `phases`
- `actions`
  - 1 個以上 action 規格
- `end`
  - `kind`（例如 `turn_limit`, `score_at_least`, `never`）
- `scoring`
  - `kind`（例如 `per_player_points`）
- `invariants`（可選）

## 2) 目前支援的 Action Kinds（以程式碼為準）

來自 `src/ir/checker.ts` 的支援集合：

- `tictactoe_place`
- `take_tokens`
- `buy_card`
- `connect4_drop`
- `take_from_pile`
- `pig_roll`
- `pig_hold`

## 3) Compiler 語意（IR -> Engine）

`compileToGameModule` 會產生 `GameModule`，含以下契約函式：

- `createInitialState(seed)`
- `legalActions(state)`
- `applyAction(state, action, rng)`
- `isTerminal(state)`
- `score(state)`

語意重點：

- 只有 checker 通過的 IR 才會編譯。
- `applyAction` 會輸出 replay event，包含 `stateHashBefore/After`。
- 若動作不合法會丟錯並拒絕狀態轉移。
- terminal 時 `phase` 會轉為 `end`。

## 4) Checker 規則（摘要）

- 玩家數需落在 `playersMin ~ playersMax`。
- action kind 必須在支援清單內。
- 特定 action 需要對應 state 結構：
  - `tictactoe_place` 需要 board
  - `take_tokens` 需要 bank
  - `buy_card` 需要 market/cardPool
  - `connect4_drop` 需要 6x7 board
  - `take_from_pile` 需要 piles 與 min/max 邊界
  - `pig_roll/pig_hold` 必須成對出現且需 `turnTotal`

## 5) 參考範例

- `src/ir/examples/tictactoe.ir.json`
- `src/ir/examples/mini_splendor.ir.json`
