# 文件總覽

本目錄收錄本專案的企劃書、架構規格、里程碑、操作手冊與驗證證據。  
閱讀順序建議先看 `proposal.md`，再看 `architecture.md`、`ir_v0.md`、`web_mvp.md`。

## 目錄

- [企劃書（主文件）](./proposal.md)
- [里程碑與交付狀態](./milestones.md)
- [系統架構（含 Mermaid）](./architecture.md)
- [IR v0 規格](./ir_v0.md)
- [Rulebook 到 IR 流程](./rulebook_to_ir.md)
- [模擬規格](./simulation.md)
- [指標規格](./metrics.md)
- [調參與 Patch Engine](./tuning_and_patch_engine.md)
- [產品化與部署規格](./productization.md)
- [Web MVP Runbook](./web_mvp.md)
- [Artifacts 輸出規格](./artifacts.md)
- [V1 範圍界定](./scope_v1.md)
- [專案狀態摘要](./status.md)
- [Soak／長時間驗證說明](./soak.md)
- [術語表](./glossary.md)
- [Codex SOP（既有）](./codex_sop.md)
- [Codex SOP（檢查點版）](./sop_codex.md)
- [證據檔案目錄](./evidence/)

## 常用驗證命令

```bash
npm test -- --coverage
npm run sim:tictactoe
npm run rb:run:tictactoe
cd apps/web && npm run build
```
