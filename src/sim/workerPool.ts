import { Worker } from "node:worker_threads";
import type { WorkerRequest, WorkerResponse, WorkerTaskName } from "./workerTasks.js";
export type { WorkerTaskName } from "./workerTasks.js";

interface PendingTask {
  id: number;
  taskName: WorkerTaskName;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface InFlightTask {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  workerIndex: number;
}

interface WorkerSlot {
  worker: Worker;
  busyTaskId: number | null;
}

export interface WorkerPool {
  runTask<TPayload, TResult>(taskName: WorkerTaskName, payload: TPayload): Promise<TResult>;
  shutdown(): Promise<void>;
}

export function createPool(input: { size: number }): WorkerPool {
  const size = Math.max(1, Math.floor(input.size));
  const slots: WorkerSlot[] = [];
  const queue: PendingTask[] = [];
  const inFlight = new Map<number, InFlightTask>();
  let nextTaskId = 1;
  let isClosing = false;
  let isClosed = false;
  let closePromise: Promise<void> | null = null;
  let closeResolve: (() => void) | null = null;

  for (let i = 0; i < size; i += 1) {
    const worker = new Worker(new URL("./workerEntry.ts", import.meta.url), {
      type: "module",
      execArgv: ["--import", "tsx"]
    });
    slots.push({ worker, busyTaskId: null });
  }

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    slot.worker.on("message", (raw: WorkerResponse) => {
      handleWorkerMessage(i, raw);
    });
    slot.worker.on("error", (error) => {
      failWorker(i, new Error(`worker error: ${error.message}`));
    });
    slot.worker.on("exit", (code) => {
      if (isClosed) {
        return;
      }
      if (code !== 0) {
        failWorker(i, new Error(`worker exited with code ${code}`));
      } else if (slot.busyTaskId !== null) {
        failWorker(i, new Error("worker exited while task was in-flight"));
      }
    });
  }

  function runTask<TPayload, TResult>(taskName: WorkerTaskName, payload: TPayload): Promise<TResult> {
    if (isClosing || isClosed) {
      return Promise.reject(new Error("worker pool is closing"));
    }

    return new Promise<TResult>((resolve, reject) => {
      const task: PendingTask = {
        id: nextTaskId,
        taskName,
        payload,
        resolve: (value) => resolve(value as TResult),
        reject
      };
      nextTaskId += 1;
      queue.push(task);
      dispatch();
    });
  }

  async function shutdown(): Promise<void> {
    if (isClosed) {
      return;
    }
    if (isClosing) {
      if (closePromise) {
        await closePromise;
      }
      return;
    }

    isClosing = true;
    closePromise = new Promise<void>((resolve) => {
      closeResolve = resolve;
    });
    checkDrainAndClose();
    await closePromise;
  }

  function dispatch(): void {
    if (isClosing || isClosed) {
      return;
    }

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (slot.busyTaskId !== null) {
        continue;
      }
      const task = queue.shift();
      if (!task) {
        return;
      }

      slot.busyTaskId = task.id;
      inFlight.set(task.id, {
        resolve: task.resolve,
        reject: task.reject,
        workerIndex: i
      });

      const message: WorkerRequest = {
        id: task.id,
        taskName: task.taskName,
        payload: task.payload
      };
      slot.worker.postMessage(message);
    }
  }

  function handleWorkerMessage(workerIndex: number, response: WorkerResponse): void {
    const slot = slots[workerIndex];
    const taskId = response.id;
    const pending = inFlight.get(taskId);
    if (!pending) {
      return;
    }
    inFlight.delete(taskId);
    slot.busyTaskId = null;

    if (response.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error));
    }

    dispatch();
    checkDrainAndClose();
  }

  function failWorker(workerIndex: number, error: Error): void {
    const slot = slots[workerIndex];
    if (slot.busyTaskId !== null) {
      const inFlightTask = inFlight.get(slot.busyTaskId);
      inFlight.delete(slot.busyTaskId);
      if (inFlightTask) {
        inFlightTask.reject(error);
      }
      slot.busyTaskId = null;
    }

    while (queue.length > 0) {
      const queued = queue.shift();
      if (!queued) {
        break;
      }
      queued.reject(error);
    }

    isClosing = true;
    checkDrainAndClose();
  }

  function checkDrainAndClose(): void {
    if (!isClosing || isClosed) {
      return;
    }
    if (queue.length > 0 || inFlight.size > 0) {
      return;
    }

    isClosed = true;
    Promise.all(slots.map((slot) => slot.worker.terminate()))
      .then(() => {
        if (closeResolve) {
          closeResolve();
        }
      })
      .catch(() => {
        if (closeResolve) {
          closeResolve();
        }
      });
  }

  return {
    runTask,
    shutdown
  };
}
