# Board Game Compiler Sandbox

這個 repo 是一個可重現的規則編譯與模擬平台：將 rulebook（文字/PDF）轉為 IR，編譯成可執行遊戲模組，再產生模擬與 replay 產物。  
詳細企劃與操作說明請見：[docs/proposal.md](./docs/proposal.md)、[docs/web_mvp.md](./docs/web_mvp.md)。

## Quickstart

```bash
npm install
npm test -- --coverage
npm run rb:run:tictactoe
```
