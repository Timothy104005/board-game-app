# Codex 檢查點 SOP

本文件定義本 repo 的固定交付流程，目標是每一步都可驗證、可回滾、可審查。

## 1) 基本原則

1. 小步提交：每個 phase 一個邏輯清楚的 commit。
2. 先驗證再提交：phase 結束前必須跑測試並確認綠燈。
3. 不提交產物：`node_modules/`、`coverage/`、`artifacts/`、`.next/`、`dist/` 一律不得進版控。
4. 固定 seed：所有可重現流程預設使用 `seed=42`，除非文件另有明確標註。
5. 不引入執行期網路依賴：runtime 只依賴本機檔案與既有程式。

## 2) 每個 Phase 的標準流程

1. 完成該 phase 的文件或程式修改。
2. 執行 phase gate 命令（至少 `npm test -- --coverage`）。
3. 若失敗，先修復再重跑直到通過。
4. `git add` 只加入本 phase 應有變更。
5. 使用 phase 指定訊息提交。

## 3) 最終收斂流程

1. 執行最終驗證：
   - `npm test -- --coverage`
   - `npm run docs:check`（若已建立）
   - `cd apps/web && npm run build`
2. 確認工作樹乾淨。
3. 產出最終回報：
   - 近期 commit 清單
   - 測試與建置輸出
   - 變更檔案列表
   - 假設與決策摘要
