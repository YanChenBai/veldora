import { fork, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { TypegenOptions } from '../config'

const WORKER_PATH = fileURLToPath(new URL('./typegen-worker.mjs', import.meta.url))

interface WorkerRequest {
  type: 'start' | 'close'
  root?: string
  typegen?: TypegenOptions
  watch?: boolean
}

interface WorkerResponse {
  type: 'generated' | 'error'
  count?: number
  message?: string
}

export interface TypegenRunner {
  close(): Promise<void>
}

export interface StartTypegenOptions {
  root: string
  typegen: TypegenOptions
  watch?: boolean
  onGenerated?: (count: number) => void
  onError?: (error: Error) => void
}

/**
 * Run typegen in a forked child process so declaration generation never blocks
 * the dev server startup. The child writes `.veldora/types` and
 * `.veldora/tsconfig.json`, then keeps watching for changes when `watch` is set.
 */
export function startTypegen(options: StartTypegenOptions): TypegenRunner {
  const child = spawnWorker()

  child.on('message', (response: WorkerResponse) => {
    if (response.type === 'generated') {
      options.onGenerated?.(response.count ?? 0)
    } else if (response.type === 'error') {
      options.onError?.(new Error(response.message))
    }
  })

  child.on('error', (error) => options.onError?.(error))

  child.send({
    type: 'start',
    root: options.root,
    typegen: options.typegen,
    watch: options.watch ?? true
  } satisfies WorkerRequest)

  return {
    async close(): Promise<void> {
      await closeWorker(child)
    }
  }
}

/**
 * Run a one-shot typegen in a child process and resolve once it finishes. The
 * promise rejects when the child exits with an error.
 */
export function runTypegenOnce(options: {
  root: string
  typegen: TypegenOptions
  onGenerated?: (count: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnWorker()

    child.on('message', (response: WorkerResponse) => {
      if (response.type === 'generated') {
        options.onGenerated?.(response.count ?? 0)
      } else if (response.type === 'error') {
        reject(new Error(response.message))
      }
    })

    child.on('error', reject)

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`veldora typegen exited with code ${code}`))
      }
    })

    child.send({ type: 'start', root: options.root, typegen: options.typegen, watch: false })
  })
}

function spawnWorker(): ChildProcess {
  return fork(WORKER_PATH, [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  })
}

function closeWorker(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.connected) {
      resolve()
      return
    }

    const killTimer = setTimeout(() => child.kill(), 1000)
    child.once('exit', () => {
      clearTimeout(killTimer)
      resolve()
    })
    child.send({ type: 'close' } satisfies WorkerRequest)
  })
}
