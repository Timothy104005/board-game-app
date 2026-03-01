# Rulebook Compiler Sandbox

This repo is a deterministic board-game rules sandbox: text rulebook -> IR draft -> compile -> simulate.
It includes invariant gates, seeded bots, replay artifacts, and regression goldens.
Use it for game rule validation, balancing experiments, and collaborator review.
Proposal document: [docs/proposal.md](./docs/proposal.md)

```bash
npm install
npm test
npm run rb:run:tictactoe
```
