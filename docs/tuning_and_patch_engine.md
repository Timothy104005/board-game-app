# 調參與 Patch Engine 規格

本文件對應 `src/tuning/*` 與 `src/ir/patch.ts` 的目前能力。

## 1) 目標函數（Current Objective）

調參流程會根據模擬結果計算 objective，核心考量包含：

- 公平性（各玩家勝率分散程度）
- 先手優勢懲罰
- 平均回合數與目標值差距
- 行為多樣性（熵或近似指標）

輸出分數越低代表候選參數越佳。

## 2) 受限 Patch 操作

目前支援：

- `set`
- `append`
- `merge`

安全約束：

- 只允許 JSON pointer 路徑操作。
- 無效操作會回報 deterministic 錯誤。
- patch 後必須經過 schema + checker 驗證。
- 編譯失敗或違反限制時不會進入正式結果。

## 3) A/B 報告格式

調參產物包含：

- `report.md`
- `report.json`
- `best.patch.json`
- `best.ir.json`

重點欄位：

- baseline 與 best objective 比較
- 主要指標差異
- 最佳 patch 操作明細
- seed 與執行參數（可重現）

## 4) 驗證命令

- `npm run tune:smoke`
- `npm run tune:splendor`
- `npm test -- --coverage`
