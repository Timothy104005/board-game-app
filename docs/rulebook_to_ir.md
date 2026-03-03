# Rulebook to IR (v0 Front-End)

This pipeline converts plain-text rulebooks into deterministic IR drafts, checker diagnostics, and patch templates.

## Flow

1. Normalize text (`normalizeRulebookText`)
2. Segment sections (`segmentRulebook`)
3. Extract signals (`extractSignals`)
4. Select deterministic recognizer template (`draftIRFromRulebookText`)
5. Run checker + gap report (`checkIR` + `buildGapReport`)
6. Suggest patch template from error gaps (`suggestPatchTemplate`)

## Recognized Templates

High-confidence recognizers in v0:

- `tictactoe`
- `mini_splendor`
- `connect4`
- `nim`
- `pig`

All other rulebooks fall back to a generic skeleton draft with actionable gaps.

## Gap to Patch Workflow

1. Generate draft and gaps:

```bash
npm run rb:2ir -- --in <rulebook.txt> --outDir artifacts/rulebook_ir
```

2. Edit `<basename>.patch.template.json` with concrete values.
3. Apply patch:

```bash
tsx scripts/applyPatch.ts --draft <draft.json> --patch <patch.json> --out <patched.json>
```

4. Review `<out>.checked.json` and `<out>.gaps.json`.

Gap severities:

- `error`: blocking issues (schema/checker/compile related)
- `warning`: ambiguous or non-blocking signals

## One-Command Run

Run full front-end pipeline and simulation:

```bash
tsx scripts/rulebookRun.ts --in <rulebook.txt> --seed 42 --games 20 --maxTurns 80 --outDir artifacts/rulebook_run
```

Outputs:

- `<base>.ir.json`
- `<base>.gaps.json`
- `<base>.patch.template.json`
- `<base>.sim.summary.json` (only when no error gaps)
- `<base>.replay.sample.json` (only when no error gaps)

Convenience scripts:

- `npm run rb:run:tictactoe`
- `npm run rb:run:splendor`
- `npm run rb:run:connect4`
- `npm run rb:run:nim`
- `npm run rb:run:pig`

## Notes

- Pipeline behavior is deterministic for fixed input + seed.
- No external APIs or network calls are used.
- A future UI can guide users through editing patch templates and rerunning validation.

## PDF Ingestion v0

PDF rulebooks can be uploaded in Web MVP and converted to plain text before running the same deterministic pipeline.

1. Upload endpoint: `POST /api/projects/[id]/upload-pdf`
2. Stored file path: `artifacts/projects/<projectId>/uploads/<uploadId>.pdf`
3. Extracted text path: `artifacts/projects/<projectId>/uploads/<uploadId>.extracted.txt`
4. Job type: `rulebook_run_pdf`
5. Run artifact path: `artifacts/projects/<projectId>/runs/<runId>/`

Output artifacts follow the same IR workflow:

- `rulebook.extracted.txt`
- `rulebook.ir.json`
- `rulebook.gaps.json`
- `rulebook.patch.template.json`
- `rulebook.sim.summary.json` (when simulation is available)
- `rulebook.replay.sample.json` (when simulation is available)

Scope note: v0 extraction is text-only and does not include OCR.
