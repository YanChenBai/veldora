import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

function child() {
  return Object.assign(new EventEmitter(), {
    pid: 123,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: vi.fn(),
    stdout: Readable.from([]),
    stderr: Readable.from([])
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('ELECTRON_ENTRY', 'fixture.js')
  vi.stubEnv('ELECTRON_EXEC_PATH', 'electron-fixture')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('Electron process lifecycle', () => {
  function captureSignals(): Map<string, () => void> {
    const handlers = new Map<string, () => void>()
    const on = process.on.bind(process)
    vi.spyOn(process, 'on').mockImplementation(((event: string, listener: () => void) => {
      if (event.startsWith('SIG')) {
        handlers.set(event, listener)
        return process
      }
      return on(event, listener)
    }) as typeof process.on)
    return handlers
  }

  it.each([false, true])(
    'reports signal termination as failure with filtering=%s',
    async (filtered) => {
      captureSignals()
      const ps = child()
      mocks.spawn.mockReturnValue(ps)
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { startElectron } = await import('../src/electron')
      startElectron(undefined, filtered ? () => true : undefined)
      ps.emit('close', null, 'SIGTERM')
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
    }
  )

  it('forwards repeated signals to the current child after a restart', async () => {
    const handlers = captureSignals()
    const first = child()
    const second = child()
    mocks.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second)
    const { startElectron } = await import('../src/electron')
    startElectron(undefined)
    const registered = handlers.size
    startElectron(undefined)
    expect(handlers.size).toBe(registered)
    handlers.get('SIGTERM')!()
    handlers.get('SIGTERM')!()
    expect(first.kill).not.toHaveBeenCalled()
    expect(second.kill).toHaveBeenCalledTimes(2)
    expect(second.kill).toHaveBeenCalledWith('SIGTERM')
    second.exitCode = 0
    handlers.get('SIGTERM')!()
    expect(second.kill).toHaveBeenCalledTimes(2)
  })

  it('preserves explicit Electron exit codes', async () => {
    captureSignals()
    const ps = child()
    mocks.spawn.mockReturnValue(ps)
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const { startElectron } = await import('../src/electron')
    startElectron(undefined)
    ps.emit('close', 7, null)
    expect(exit).toHaveBeenCalledWith(7)
  })
})
