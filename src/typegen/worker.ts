import process from 'node:process'
import type { TypegenOptions } from '../config'
import { generateTypes, watchTypes, type TypegenController } from './index'

interface StartMessage {
  type: 'start'
  root: string
  typegen: TypegenOptions
  watch: boolean
}

interface CloseMessage {
  type: 'close'
}

type WorkerMessage = StartMessage | CloseMessage

let controller: TypegenController | undefined

process.on('message', (message: WorkerMessage) => {
  if (message.type === 'start') {
    void run(message)
  } else if (message.type === 'close') {
    void shutdown()
  }
})

// Exit when the parent closes the IPC channel (e.g. the dev server dies).
process.on('disconnect', () => {
  process.exit(0)
})

async function run(message: StartMessage): Promise<void> {
  const count = Object.keys(message.typegen.entries).length

  try {
    // One-shot generation first, so the declarations and `index.d.ts` exist
    // before completion is reported (the watcher's async initial build would
    // otherwise resolve before anything is written).
    await generateTypes(message.typegen, message.root)

    process.send?.({ type: 'generated', count })

    if (message.watch) {
      controller = await watchTypes(message.typegen, message.root)
    } else {
      process.exit(0)
    }
  } catch (error) {
    process.send?.({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
    process.exit(1)
  }
}

async function shutdown(): Promise<void> {
  await controller?.close()
  process.exit(0)
}
