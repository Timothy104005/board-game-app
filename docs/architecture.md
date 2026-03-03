# 系統架構

本文件描述目前程式碼已實作的主要組件、任務流程與核心資料模型。

## 1) 元件圖（Component Diagram）

```mermaid
flowchart LR
  U[使用者 UI] --> WEB[Next.js Web MVP]
  WEB --> API[Route Handlers / Server Actions]
  API --> QUEUE[Durable Queue Store<br/>projects.json runs.json queue.json]
  QUEUE --> WORKER[Worker Daemon]
  WORKER --> PIPE[Rulebook Pipeline<br/>normalize + extract + draft IR]
  PIPE --> CHECK[IR Checker]
  CHECK --> COMP[IR Compiler]
  COMP --> ENG[Game Engine Module]
  ENG --> BOTS[Random / Greedy Bots]
  BOTS --> SIM[Batch Simulation]
  SIM --> ART[Artifacts + Manifest + Logs]
  ART --> WEB
```

## 2) 任務序列圖（Job-based Run）

```mermaid
sequenceDiagram
  participant User as User
  participant Web as apps/web
  participant Queue as src/jobs/queue.ts
  participant Worker as src/jobs/worker.ts
  participant Exec as src/jobs/executors.ts
  participant FS as artifacts/*

  User->>Web: 建立專案 / 觸發 Run
  Web->>Queue: enqueue(jobType, projectId, payload)
  Queue-->>Web: runId
  Web-->>User: 顯示 queued

  Worker->>Queue: dequeueNextRun()
  Queue-->>Worker: run
  Worker->>Queue: markRunStatus(running)
  Worker->>Exec: executeRun(run, project)
  Exec->>FS: 寫入 ir/gaps/patch/replay/summary
  Exec-->>Worker: manifest data + projectPatch
  Worker->>FS: 寫入 manifest.json / logs.txt
  Worker->>Queue: markRunStatus(succeeded|failed)
  Web->>FS: 讀取 manifest 與 artifacts
  Web-->>User: 顯示 run 狀態與連結
```

## 3) 資料模型圖（Project / Run / Job / IR / Patch / Replay）

```mermaid
classDiagram
  class Project {
    +id: pXXXXXX
    +name
    +rulebookText
    +seedDefault
    +latestRunId
    +latestIrPath
    +latestReplayPath
  }

  class Job {
    +jobType
    +payload
  }

  class Run {
    +id: rXXXXXX
    +projectId
    +status
    +runDir
    +manifestPath
    +startedAt
    +finishedAt
  }

  class IR {
    +meta
    +state
    +turn
    +actions
    +end
    +scoring
  }

  class Patch {
    +operations[]
    +op: set|append|merge
  }

  class Replay {
    +steps[]
    +stateHashBefore
    +stateHashAfter
  }

  Project --> Run : has many
  Run --> Job : executes
  Run --> IR : emits artifact
  Run --> Patch : consumes/emits
  Run --> Replay : emits sample
```

## 4) 實作對照

- Queue/Store：`src/jobs/queue.ts`, `src/jobs/store.ts`
- Worker：`src/jobs/worker.ts`, `scripts/workerDaemon.ts`
- Executor：`src/jobs/executors.ts`
- Web API：`apps/web/app/api/**/route.ts`
- Artifacts：`artifacts/jobs/*`、`artifacts/projects/*`
