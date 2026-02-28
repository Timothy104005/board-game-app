# Codex SOP (No-Questions, Tests-First)

This repo follows a deterministic implementation workflow for feature delivery.

## Operating rules

- Do not ask clarifying questions when decisions are locked.
- Choose the simplest implementation that matches existing patterns.
- Prefer minimal changes over refactors.
- Keep behavior deterministic under a fixed seed.

## Delivery flow

1. Apply requested changes in small, reviewable edits.
2. Run tests early and often.
3. Fix failures immediately before moving on.
4. Run full verification (`npm test -- --coverage`) before reporting.
5. Return:
   - full test output
   - coverage summary
   - changed files
   - brief assumptions
