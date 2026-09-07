import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import ts from 'typescript'
import { build as viteBuild } from 'vite'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { generateTypes } from '../src/typegen'
import { resolveTypegenEntries } from '../src/typegen/entries'
import { writeTypegenTsconfig } from '../src/typegen/tsconfig'
import { typegenGuardPlugin } from '../src/plugins/typegenGuard'

const cleanups: string[] = []

afterEach(() => {
  for (const dir of cleanups.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'veldora-typegen-'))
  cleanups.push(root)
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return root
}

function read(root: string, rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel))
}

function normalize(p: string | undefined): string {
  return (p || '').replace(/\\/g, '/')
}

const SRC = {
  'src/ipc.ts': `export interface User {
  id: string
  name: string
}

export interface AppRouter {
  user: {
    get(id: string): Promise<User>
  }
}
`,
  'src/services.ts': `export interface Service {
  run(): void
}
`,
  'src/events.ts': `export interface Event {
  name: string
}
`
}

describe('resolveTypegenEntries', () => {
  it('resolves entries to absolute paths', () => {
    const root = createFixture({ 'src/ipc.ts': '' })
    const entries = resolveTypegenEntries({ entries: { ipc: 'src/ipc.ts' } }, root)
    expect(entries.ipc).toBe(path.resolve(root, 'src/ipc.ts'))
  })

  it('rejects invalid entry names', () => {
    const root = createFixture({ 'src/ipc.ts': '' })
    expect(() => resolveTypegenEntries({ entries: { 'foo/bar': 'src/ipc.ts' } }, root)).toThrow(
      /Invalid entry name/
    )
  })

  it('rejects missing source files', () => {
    const root = createFixture({})
    expect(() => resolveTypegenEntries({ entries: { ipc: 'src/missing.ts' } }, root)).toThrow(
      /does not exist/
    )
  })
})

describe('writeTypegenTsconfig', () => {
  it('writes the generated tsconfig with the veldora-types aliases', () => {
    const root = createFixture({})
    writeTypegenTsconfig(root)

    const tsconfig = JSON.parse(read(root, '.veldora/tsconfig.json'))
    expect(tsconfig.compilerOptions.paths).toEqual({
      'veldora-types': ['./types/index.d.ts'],
      'veldora-types/*': ['./types/*.d.ts']
    })
  })

  it('is idempotent', () => {
    const root = createFixture({})
    writeTypegenTsconfig(root)
    const first = read(root, '.veldora/tsconfig.json')
    const mtime = fs.statSync(path.join(root, '.veldora/tsconfig.json')).mtimeMs

    writeTypegenTsconfig(root)

    expect(read(root, '.veldora/tsconfig.json')).toBe(first)
    expect(fs.statSync(path.join(root, '.veldora/tsconfig.json')).mtimeMs).toBe(mtime)
  })
})

describe('generateTypes', () => {
  it('generates declarations for multiple entries', async () => {
    const root = createFixture(SRC)

    await generateTypes({ entries: { ipc: 'src/ipc.ts', services: 'src/services.ts' } }, root)

    expect(exists(root, '.veldora/tsconfig.json')).toBe(true)
    expect(exists(root, '.veldora/types/ipc.d.ts')).toBe(true)
    expect(exists(root, '.veldora/types/services.d.ts')).toBe(true)
    expect(exists(root, '.veldora/types/index.d.ts')).toBe(true)

    expect(read(root, '.veldora/types/ipc.d.ts')).toContain('AppRouter')
    expect(read(root, '.veldora/types/services.d.ts')).toContain('Service')

    const index = read(root, '.veldora/types/index.d.ts')
    expect(index).toContain(`export type * from './ipc'`)
    expect(index).toContain(`export type * from './services'`)
  })

  it('honors tsconfig path aliases when emitting declarations', async () => {
    const root = createFixture({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true
        },
        include: ['src']
      }),
      'src/shared.ts': `export interface Shared {
  version: string
}
`,
      'src/ipc.ts': `import type { Shared } from '@/shared'

export interface AppRouter extends Shared {
  user: {
    get(id: string): Promise<{ id: string }>
  }
}
`
    })

    await generateTypes({ entries: { ipc: 'src/ipc.ts' } }, root)

    const dts = read(root, '.veldora/types/ipc.d.ts')
    expect(dts).toContain('AppRouter')
    expect(dts).toContain('version')
  })

  it('resolves veldora-types imports when the user extends the generated tsconfig', async () => {
    const root = createFixture(SRC)
    await generateTypes({ entries: { ipc: 'src/ipc.ts' } }, root)

    fs.writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: './.veldora/tsconfig.json',
          compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', strict: true },
          include: ['src']
        },
        null,
        2
      )
    )
    fs.writeFileSync(
      path.join(root, 'src', 'app.ts'),
      `import type { AppRouter } from 'veldora-types'\nimport type { AppRouter as R } from 'veldora-types/ipc'\nexport const a: AppRouter = { user: { get: async () => ({ id: '1', name: 'x' }) } }\nexport const b: R = { user: { get: async () => ({ id: '1', name: 'x' }) } }\n`
    )

    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)

    const resolved = ts.resolveModuleName(
      'veldora-types',
      path.join(root, 'src/app.ts'),
      parsed.options,
      ts.sys
    )
    expect(normalize(resolved.resolvedModule?.resolvedFileName)).toBe(
      normalize(path.join(root, '.veldora/types/index.d.ts'))
    )

    const subpath = ts.resolveModuleName(
      'veldora-types/ipc',
      path.join(root, 'src/app.ts'),
      parsed.options,
      ts.sys
    )
    expect(normalize(subpath.resolvedModule?.resolvedFileName)).toBe(
      normalize(path.join(root, '.veldora/types/ipc.d.ts'))
    )
  })
})

describe('typegenGuardPlugin', () => {
  const plugin = typegenGuardPlugin()

  it('throws on runtime imports of veldora-types', () => {
    expect(() => plugin.resolveId?.('veldora-types', undefined, {} as never)).toThrow(
      /type-only and cannot be imported at runtime/
    )
    expect(() => plugin.resolveId?.('veldora-types/ipc', undefined, {} as never)).toThrow(
      /type-only and cannot be imported at runtime/
    )
  })

  it('does not interfere with other modules', () => {
    expect(plugin.resolveId?.('some-module', undefined, {} as never)).toBeUndefined()
    expect(plugin.resolveId?.('electron', undefined, {} as never)).toBeUndefined()
  })
})

describe('typegenGuardPlugin (build integration)', () => {
  function buildEntry(root: string, code: string): Promise<unknown> {
    const entry = path.join(root, 'entry.ts')
    fs.writeFileSync(entry, code)

    return viteBuild({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [typegenGuardPlugin()],
      build: {
        outDir: path.join(root, 'out'),
        rolldownOptions: { input: entry },
        minify: false
      }
    })
  }

  it('erases type-only imports before resolution', async () => {
    const root = createFixture({})
    await expect(
      buildEntry(
        root,
        "import type { AppRouter } from 'veldora-types'\nexport const x: AppRouter | null = null\n"
      )
    ).resolves.toBeTruthy()

    await expect(
      buildEntry(
        root,
        "import type { AppRouter } from 'veldora-types/ipc'\nexport const x: AppRouter | null = null\n"
      )
    ).resolves.toBeTruthy()
  })

  it('rejects runtime imports of veldora-types', async () => {
    const root = createFixture({})
    await expect(
      buildEntry(root, "import { AppRouter } from 'veldora-types'\nexport const x = AppRouter\n")
    ).rejects.toThrow(/type-only/)

    await expect(
      buildEntry(
        root,
        "import { AppRouter } from 'veldora-types/ipc'\nexport const x = AppRouter\n"
      )
    ).rejects.toThrow(/type-only/)
  })
})
