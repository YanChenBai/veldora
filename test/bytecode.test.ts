import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { build, type Rolldown } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { bytecodePlugin } from '../src/plugins/bytecode'

const require = createRequire(import.meta.url)
const compile = require('../bin/bytecode-compiler.cjs') as (code: string) => {
  sourceLength: number
  cachedData: string
}
const directories: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
  )
})

describe('bytecode bundles', () => {
  it.each(['main', 'preload'] as const)(
    'compiles and loads distinct same-length %s modules with a global RegExp',
    async (target) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'veldora-bytecode-'))
      directories.push(root)
      await fs.writeFile(path.join(root, 'one.js'), `export const value = 'alpha'`)
      await fs.writeFile(path.join(root, 'two.js'), `export const value = 'bravo'`)
      vi.stubEnv('NODE_ENV_ELECTRON_VITE', 'production')
      const compiler = { compile: vi.fn(async (_target: string, code: string) => compile(code)) }
      const result = (await build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [
          { name: 'vite:veldora-bytecode-build', api: { compiler } },
          { name: `vite:electron-${target}-config-preset` },
          bytecodePlugin({ chunkAlias: /one|two/g, protectedStrings: ['alpha', 'bravo'] })
        ],
        build: {
          ssr: true,
          write: false,
          minify: false,
          lib: {
            entry: { one: path.join(root, 'one.js'), two: path.join(root, 'two.js') },
            formats: ['cjs']
          },
          rolldownOptions: { output: { entryFileNames: '[name].cjs' } }
        }
      })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[]
      const { output } = Array.isArray(result) ? result[0] : result
      expect(compiler.compile).toHaveBeenCalledTimes(2)
      expect(compiler.compile.mock.calls.every(([context]) => context === target)).toBe(true)
      for (const item of output) {
        await fs.writeFile(
          path.join(root, item.fileName),
          item.type === 'chunk' ? item.code : item.source
        )
      }
      const cached = output.filter((item) => item.fileName.endsWith('.cjsc'))
      expect(cached).toHaveLength(2)
      for (const item of cached) {
        if (item.type !== 'asset') throw new Error('Expected bytecode asset')
        expect(Buffer.from(item.source).subarray(0, 8).toString()).toBe('EVBC0001')
      }
      const loaded = spawnSync(
        process.execPath,
        [
          '-e',
          `require('./one.cjs'); require('./two.cjs'); console.log(JSON.stringify([require('./one.cjsc').value, require('./two.cjsc').value]))`
        ],
        { cwd: root, encoding: 'utf8' }
      )
      expect(loaded.stderr).toBe('')
      expect(loaded.status).toBe(0)
      expect(JSON.parse(loaded.stdout)).toEqual(['alpha', 'bravo'])
    }
  )
})
