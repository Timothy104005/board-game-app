# 里程碑追蹤（Milestones）

## 里程碑總表

| 里程碑 | 狀態 | Purpose | Deliverables | Acceptance Commands | Repo 證據 |
|---|---|---|---|---|---|
| M1 引擎契約與不變量 | DONE | 建立可重現執行核心 | engine contract、invariant gate、基本遊戲執行模型 | `npm test -- --coverage` | [npm_test.txt](./evidence/npm_test.txt) |
| M2 IR v0 與編譯器 | DONE | 建立 IR schema/checker/compiler | IR v0 schema、checker、compileToGameModule、integration tests | `npm test -- --coverage`<br>`npm run rb:run:tictactoe` | [npm_test.txt](./evidence/npm_test.txt)<br>[rb_run_tictactoe.txt](./evidence/rb_run_tictactoe.txt) |
| M3 Rulebook 流水線與模擬 | DONE | 打通 rulebook -> IR -> simulate | `ir/gaps/patchTemplate/sim/replay` 產物輸出 | `npm run rb:run:tictactoe`<br>`npm run rb:run:pig`<br>`npm run sim:tictactoe` | [rb_run_tictactoe.txt](./evidence/rb_run_tictactoe.txt)<br>[rb_run_pig.txt](./evidence/rb_run_pig.txt)<br>[sim_tictactoe.txt](./evidence/sim_tictactoe.txt) |
| M4 調參與受限 Patch Engine | DONE | 提供可控 A/B 優化流程 | tuner、objective、restricted patch ops、報告輸出 | `npm test -- --coverage`<br>`npm run sim:splendor` | [npm_test.txt](./evidence/npm_test.txt)<br>[sim_splendor.txt](./evidence/sim_splendor.txt) |
| M5 Web MVP + Durable Jobs | IN PROGRESS | 產品化任務執行與可視化 | Next.js Web、queue/store/worker、PDF ingestion、E2E、CI 分層 | `npm test -- --coverage`<br>`cd apps/web && npm run build` | [npm_test.txt](./evidence/npm_test.txt)<br>[web_build.txt](./evidence/web_build.txt)<br>[git_log.txt](./evidence/git_log.txt) |

## M5 驗證流程（本機）

1. `npm run jobs:worker`
2. `cd apps/web && npm run dev`
3. 建立專案並執行 `Run Rulebook` 或 `Run from PDF`
4. 在 run 頁面確認 `ir`、`gaps`、`patchTemplate`、`sampleReplay`
5. `npm run jobs:smoke`
