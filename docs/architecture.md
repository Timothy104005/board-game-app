# Architecture

## High-Level Components

```mermaid
flowchart LR
  A[Rulebook Input] --> B[Normalize / Segment / Signals]
  B --> C[IR Draft]
  C --> D[Checker + Gap Report]
  D --> E[Patch Template]
  C --> F[Compiler]
  F --> G[GameModule Engine]
  G --> H[Bots + Simulation]
  H --> I[Reports + Artifacts]
```

## Sequence: `rb:run` Pipeline

```mermaid
sequenceDiagram
  participant U as User
  participant CLI as rulebookRun CLI
  participant RB as Rulebook Pipeline
  participant IR as Checker/Gap
  participant CMP as Compiler
  participant SIM as Simulation
  participant FS as Artifacts

  U->>CLI: run rb:run --in <rulebook>
  CLI->>RB: draftIRFromRulebookText(text)
  RB-->>CLI: irDraft + debug
  CLI->>IR: checkIR + buildGapReport
  IR-->>CLI: gaps
  CLI->>IR: suggestPatchTemplate
  IR-->>CLI: patchTemplate

  alt gaps has errors
    CLI->>FS: write ir + gaps + patchTemplate
    CLI-->>U: exit code 1
  else no error gaps
    CLI->>CMP: compileToGameModule(irDraft)
    CMP-->>CLI: game module
    CLI->>SIM: runBatch / runMatch (seeded)
    SIM-->>CLI: summary + replay
    CLI->>FS: write ir + gaps + patchTemplate + summary + replay
    CLI-->>U: exit code 0
  end
```

## Data Model

```mermaid
classDiagram
  class GameIRv0 {
    +meta
    +rng
    +state
    +turn
    +actions
    +end
    +scoring
    +invariants
  }

  class IRPatch {
    +operations[]
  }

  class GapReport {
    +gaps[]
    +summary{errors,warnings}
    +notes[]
  }

  class ReplayEvent {
    +index
    +seed
    +turn
    +actor
    +action
    +stateHashBefore
    +stateHashAfter
  }

  class BatchSummary {
    +matches
    +winRates
    +averageTurns
    +actionDistribution
  }

  GameIRv0 --> IRPatch : fixed by
  GameIRv0 --> GapReport : validated by
  GameIRv0 --> ReplayEvent : compiled runtime emits
  ReplayEvent --> BatchSummary : aggregated into
```
