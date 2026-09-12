import { Readable, Writable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import electronVersions from '../src/electronVersions.json'
import {
  filterConsoleOutput,
  getElectronChromeTarget,
  getElectronNodeTarget,
  pipeFilteredOutput
} from '../src/electron'

describe('electron build targets', () => {
  const majors = Object.keys(electronVersions.versions).map(Number)
  const newestMajor = Math.max(...majors)
  const newestEntry = electronVersions.versions[String(newestMajor)]
  const newestNodeTarget = `node${newestEntry.node.split('.').slice(0, 2).join('.')}`
  const newestChromeTarget = `chrome${newestEntry.chrome.split('.')[0]}`
  const originalMajorVer = process.env.ELECTRON_MAJOR_VER

  afterEach(() => {
    if (originalMajorVer === undefined) delete process.env.ELECTRON_MAJOR_VER
    else process.env.ELECTRON_MAJOR_VER = originalMajorVer
  })

  it('maps a known electron major to its bundled node and chrome versions', () => {
    process.env.ELECTRON_MAJOR_VER = String(newestMajor)

    expect(getElectronNodeTarget()).toBe(newestNodeTarget)
    expect(getElectronChromeTarget()).toBe(newestChromeTarget)
  })

  it('falls back to the newest known entry for a newer electron major', () => {
    process.env.ELECTRON_MAJOR_VER = String(newestMajor + 5)

    expect(getElectronNodeTarget()).toBe(newestNodeTarget)
    expect(getElectronChromeTarget()).toBe(newestChromeTarget)
  })

  it('maps an end-of-life electron major to its frozen node and chrome versions', () => {
    // Electron 22 is EOL, so the versions it bundled can never change: this
    // pins the mapping logic independently of the data file.
    process.env.ELECTRON_MAJOR_VER = '22'

    expect(getElectronNodeTarget()).toBe('node16.17')
    expect(getElectronChromeTarget()).toBe('chrome108')
  })

  it('returns no target for electron 10 and below', () => {
    process.env.ELECTRON_MAJOR_VER = '10'

    expect(getElectronNodeTarget()).toBe('')
    expect(getElectronChromeTarget()).toBe('')
  })
})

describe('electron version data', () => {
  // The resolved targets are dereferenced with `.split()` at build time, so a
  // malformed entry fails every user build rather than this test. The updater
  // validates the feed for the same reason; this guards the checked-in file,
  // including changes that arrive by hand.
  const entries = Object.entries(electronVersions.versions)

  it('is not empty and carries its provenance', () => {
    expect(entries.length).toBeGreaterThan(0)
    expect(electronVersions.source).toBe('https://releases.electronjs.org/releases.json')
    expect(electronVersions.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('keys every entry by its own electron major', () => {
    for (const [key, entry] of entries) {
      expect(Number(key)).not.toBeNaN()
      expect(entry.electron.split('.')[0]).toBe(key)
    }
  })

  it('stores node and chrome versions in the shape the runtime splits', () => {
    for (const [key, entry] of entries) {
      expect(entry.node, `node for electron ${key}`).toMatch(/^\d+\.\d+\.\d+$/)
      expect(entry.chrome, `chrome for electron ${key}`).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
    }
  })
})

describe('filterConsoleOutput', () => {
  it('forwards lines that do not match the filter', () => {
    const result = filterConsoleOutput('hello\nworld\n', '', () => false)
    expect(result.buffer).toBe('')
    expect(result.output).toBe('hello\nworld\n')
  })

  it('suppresses lines that match the filter', () => {
    const filter = (line: string): boolean => line.includes('stun.chat.bilibili.com')
    const line =
      '[41952:0907/191159.416:ERROR:services/network/p2p/socket_manager.cc:145] Failed to resolve address for stun.chat.bilibili.com., errorcode: -105'
    const result = filterConsoleOutput(`${line}\nok\n`, '', filter)
    expect(result.output).toBe('ok\n')
  })

  it('accumulates partial lines across chunks', () => {
    const filter = (line: string): boolean => line.includes('error')
    const first = filterConsoleOutput('some ', '', filter)
    const second = filterConsoleOutput('error line\nnext\n', first.buffer, filter)
    expect(second.output).toBe('next\n')
    expect(second.buffer).toBe('')
  })

  it('normalizes CRLF line endings', () => {
    const filter = (line: string): boolean => line.includes('drop')
    const result = filterConsoleOutput('keep\r\ndrop me\r\n', '', filter)
    expect(result.output).toBe('keep\n')
  })
})

describe('pipeFilteredOutput', () => {
  it('drains all output to a slow destination before resolving', async () => {
    const written: string[] = []
    const slowDest = new Writable({
      write(chunk, _encoding, callback) {
        written.push(chunk.toString())
        setTimeout(callback, 20)
      }
    })

    const source = Readable.from(['line one\n', 'line two\n'])
    const done = pipeFilteredOutput(source, slowDest, () => false)

    let settled = false
    done.then(() => {
      settled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(settled).toBe(false)

    await done
    expect(settled).toBe(true)
    expect(written.join('')).toBe('line one\nline two\n')
  })
})
