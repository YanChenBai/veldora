import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { type ChildProcess, spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import type { ConsoleFilter } from './config'
import { loadPackageData } from './utils'

const _require = createRequire(import.meta.url)

const ensureElectronEntryFile = (root = process.cwd()): void => {
  if (process.env.ELECTRON_ENTRY) return
  const pkg = loadPackageData()
  if (pkg) {
    if (!pkg.main) {
      throw new Error(
        'No entry point found for electron app, please add a "main" field to package.json'
      )
    } else {
      const entryPath = path.resolve(root, pkg.main)
      if (!fs.existsSync(entryPath)) {
        throw new Error(`No electron app entry file found: ${entryPath}`)
      }
    }
  } else {
    throw new Error('Not found: package.json')
  }
}

const getElectronMajorVer = (): string => {
  let majorVer = process.env.ELECTRON_MAJOR_VER || ''
  if (!majorVer) {
    const pkg = _require.resolve('electron/package.json')
    if (fs.existsSync(pkg)) {
      const version = _require(pkg).version
      majorVer = version.split('.')[0]
      process.env.ELECTRON_MAJOR_VER = majorVer
    }
  }
  return majorVer
}

export function supportESM(): boolean {
  const majorVer = getElectronMajorVer()
  return parseInt(majorVer) >= 28
}

export function supportImportMetaPaths(): boolean {
  const majorVer = getElectronMajorVer()
  return parseInt(majorVer) >= 30
}

export function getElectronPath(): string {
  let electronExecPath = process.env.ELECTRON_EXEC_PATH || ''
  if (!electronExecPath) {
    const electronModulePath = path.dirname(_require.resolve('electron'))
    const pathFile = path.join(electronModulePath, 'path.txt')
    let executablePath
    if (fs.existsSync(pathFile)) {
      executablePath = fs.readFileSync(pathFile, 'utf-8')
    }
    if (executablePath) {
      electronExecPath = path.join(electronModulePath, 'dist', executablePath)
      process.env.ELECTRON_EXEC_PATH = electronExecPath
    } else {
      throw new Error('Electron uninstall')
    }
  }
  return electronExecPath
}

export function getElectronNodeTarget(): string {
  const electronVer = getElectronMajorVer()

  const nodeVer = {
    '41': '24.14',
    '40': '24.14',
    '39': '22.20',
    '38': '22.19',
    '37': '22.16',
    '36': '22.14',
    '35': '22.14',
    '34': '20.18',
    '33': '20.18',
    '32': '20.16',
    '31': '20.14',
    '30': '20.11',
    '29': '20.9',
    '28': '18.18',
    '27': '18.17',
    '26': '18.16',
    '25': '18.15',
    '24': '18.14',
    '23': '18.12',
    '22': '16.17'
  }
  if (electronVer && parseInt(electronVer) > 10) {
    let target = nodeVer[electronVer]
    if (!target) target = Object.values(nodeVer).reverse()[0]
    return 'node' + target
  }
  return ''
}

export function getElectronChromeTarget(): string {
  const electronVer = getElectronMajorVer()

  const chromeVer = {
    '41': '146',
    '40': '144',
    '39': '142',
    '38': '140',
    '37': '138',
    '36': '136',
    '35': '134',
    '34': '132',
    '33': '130',
    '32': '128',
    '31': '126',
    '30': '124',
    '29': '122',
    '28': '120',
    '27': '118',
    '26': '116',
    '25': '114',
    '24': '112',
    '23': '110',
    '22': '108'
  }
  if (electronVer && parseInt(electronVer) > 10) {
    let target = chromeVer[electronVer]
    if (!target) target = Object.values(chromeVer).reverse()[0]
    return 'chrome' + target
  }
  return ''
}

export function startElectron(
  root: string | undefined,
  filterConsole?: ConsoleFilter
): ChildProcess {
  ensureElectronEntryFile(root)

  const electronPath = getElectronPath()

  const isDev = process.env.NODE_ENV_ELECTRON_VITE === 'development'

  const args: string[] = process.env.ELECTRON_CLI_ARGS
    ? JSON.parse(process.env.ELECTRON_CLI_ARGS)
    : []

  if (!!process.env.REMOTE_DEBUGGING_PORT && isDev) {
    args.push(`--remote-debugging-port=${process.env.REMOTE_DEBUGGING_PORT}`)
  }

  if (!!process.env.V8_INSPECTOR_PORT && isDev) {
    args.push(`--inspect=${process.env.V8_INSPECTOR_PORT}`)
  }

  if (!!process.env.V8_INSPECTOR_BRK_PORT && isDev) {
    args.push(`--inspect-brk=${process.env.V8_INSPECTOR_BRK_PORT}`)
  }

  if (process.env.NO_SANDBOX === '1') {
    args.push('--no-sandbox')
  }

  const entry = process.env.ELECTRON_ENTRY || '.'

  // Don't inherit stdin so the CLI shortcuts keep reading from the terminal.
  // On Windows, a GUI child (electron) inheriting the console input would
  // otherwise steal keystrokes from the parent's readline.
  const ps = spawn(electronPath, [entry].concat(args), {
    stdio: ['ignore', filterConsole ? 'pipe' : 'inherit', filterConsole ? 'pipe' : 'inherit']
  })
  if (filterConsole && ps.stdout && ps.stderr) {
    const stdoutDrained = pipeFilteredOutput(ps.stdout, process.stdout, filterConsole)
    const stderrDrained = pipeFilteredOutput(ps.stderr, process.stderr, filterConsole)
    ps.on('close', (code) => {
      Promise.all([stdoutDrained, stderrDrained]).then(() => process.exit(code ?? 0))
    })
  } else {
    ps.on('close', process.exit)
  }

  return ps
}

/**
 * Filter a child process output stream line by line, forwarding only the
 * lines for which `filter` returns `false`.
 *
 * @returns a promise that resolves once the source has ended and every
 * forwarded chunk has been flushed to the destination.
 */
export function pipeFilteredOutput(
  source: Readable,
  dest: Writable,
  filter: ConsoleFilter
): Promise<void> {
  return new Promise((resolve) => {
    let buffer = ''
    let pending = 0
    let ended = false

    const flush = (output: string): void => {
      pending++
      dest.write(output, () => {
        pending--
        maybeDone()
      })
    }

    const maybeDone = (): void => {
      if (ended && pending === 0) resolve()
    }

    source.setEncoding('utf8')
    source.on('data', (chunk: string) => {
      const result = filterConsoleOutput(chunk, buffer, filter)
      buffer = result.buffer
      if (result.output) flush(result.output)
    })
    source.on('end', () => {
      if (buffer && !filter(buffer)) flush(buffer)
      ended = true
      maybeDone()
    })
    source.on('error', () => {
      ended = true
      maybeDone()
    })
  })
}

/**
 * Accumulate console output chunks and filter complete lines.
 *
 * @returns the remaining partial line and the output to write.
 */
export function filterConsoleOutput(
  chunk: string,
  buffer: string,
  filter: ConsoleFilter
): { buffer: string; output: string } {
  let text = buffer + chunk
  let output = ''
  let index: number
  while ((index = text.indexOf('\n')) !== -1) {
    let line = text.slice(0, index)
    text = text.slice(index + 1)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    if (!filter(line)) {
      output += line + '\n'
    }
  }
  return { buffer: text, output }
}
