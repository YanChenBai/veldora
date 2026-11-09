import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { BytecodeCompiler } from '../src/bytecodeCompiler'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

type Request = { type: string; invocationId: number; cmd: string; args: unknown[] }

function compilerProcess() {
  const ps = Object.assign(new EventEmitter(), {
    connected: true,
    stderr: new PassThrough(),
    kill: vi.fn(),
    send: vi.fn((message: Request, callback: (error?: Error) => void) => {
      queueMicrotask(() => {
        callback()
        if (message.type === 'shutdown') {
          ps.connected = false
          ps.emit('close')
        } else if (message.cmd === 'ready') {
          ps.emit('message', { type: 'response', invocationId: message.invocationId, result: true })
        }
      })
    })
  })
  mocks.spawn.mockReturnValue(ps)
  vi.stubEnv('ELECTRON_EXEC_PATH', 'fixture-electron')
  return ps
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('shared bytecode compiler', () => {
  it('shares initialization and preserves the environment while disabling run-as-node', async () => {
    const ps = compilerProcess()
    vi.stubEnv('ELECTRON_RUN_AS_NODE', '1')
    vi.stubEnv('VELDORA_SMOKE_ENV', 'preserved')
    const compiler = new BytecodeCompiler()
    await Promise.all([compiler.start(), compiler.start()])
    expect(mocks.spawn).toHaveBeenCalledTimes(1)
    const options = mocks.spawn.mock.calls[0][2]
    expect(options.env.VELDORA_SMOKE_ENV).toBe('preserved')
    expect(options.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(options.windowsHide).toBe(true)
    const pending = compiler.compile('preload', 'module.exports = 1')
    const request = ps.send.mock.calls.at(-1)![0]
    expect(request.args).toEqual(['preload', 'module.exports = 1'])
    ps.emit('message', {
      type: 'response',
      invocationId: request.invocationId,
      result: { sourceLength: 18, cachedData: 'YQ==' }
    })
    await expect(pending).resolves.toEqual({ sourceLength: 18, cachedData: 'YQ==' })
    await compiler.stop()
  })

  it('rejects pending work with compiler stderr when IPC disconnects', async () => {
    const ps = compilerProcess()
    const compiler = new BytecodeCompiler()
    await compiler.start()
    const pending = compiler.compile('main', 'invalid')
    ps.stderr.write('compiler crash detail')
    ps.emit('disconnect')
    await expect(pending).rejects.toThrow(/Electron IPC disconnected\ncompiler crash detail/)
    await compiler.stop()
    await expect(compiler.compile('main', 'code')).rejects.toThrow('not ready')
  })

  it('surfaces a remote compilation failure and still shuts down', async () => {
    const ps = compilerProcess()
    const compiler = new BytecodeCompiler()
    await compiler.start()
    const pending = compiler.compile('main', 'bad syntax')
    const request = ps.send.mock.calls.at(-1)![0]
    ps.emit('message', {
      type: 'response',
      invocationId: request.invocationId,
      error: { name: 'SyntaxError', message: 'bad source' }
    })
    await expect(pending).rejects.toThrow('bad source')
    await compiler.stop()
    expect(ps.send.mock.calls.at(-1)![0].type).toBe('shutdown')
  })
})
