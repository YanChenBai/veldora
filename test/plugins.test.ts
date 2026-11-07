import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, type Rolldown } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import esmShimPlugin from '../src/plugins/esmShim'
import assetPlugin from '../src/plugins/asset'

const directories: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
  )
})

async function fixture(source: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'veldora-plugins-'))
  directories.push(root)
  await fs.writeFile(path.join(root, 'index.js'), source)
  vi.stubEnv('ELECTRON_MAJOR_VER', '30')
  return root
}

describe('upstream plugin fixes', () => {
  it('inserts ESM shims after real imports, ignoring import-like strings and comments', async () => {
    const root = await fixture(`
      import { existsSync } from 'node:fs'
      export const text = "text import fake from 'fake'"
      export const filename = __filename
      export const exists = existsSync('.')
    `)
    const result = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [
        esmShimPlugin(),
        {
          name: 'validate-shim-syntax',
          enforce: 'post',
          renderChunk(code) {
            this.parse(code)
            return null
          }
        }
      ],
      build: {
        ssr: true,
        write: false,
        minify: false,
        lib: { entry: path.join(root, 'index.js'), formats: ['es'] }
      }
    })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[]
    const output = Array.isArray(result) ? result[0] : result
    const chunk = output.output.find((item) => item.type === 'chunk')!
    expect(chunk.code).toContain('import.meta.filename')
    expect(chunk.code).toContain("text import fake from 'fake'")
    expect(chunk.code).not.toContain("text import fake from '\n")
  })

  it('reuses the same asset reference across query variants', async () => {
    const root = await fixture(
      `import asset from './sample.bin?asset'; import unpacked from './sample.bin?asset&asarUnpack'; export { asset, unpacked }`
    )
    await fs.writeFile(path.join(root, 'sample.bin'), 'fixture')
    const plugin = assetPlugin()
    const load = plugin.load as (this: unknown, id: string) => Promise<unknown>
    const environment = { config: { publicDir: false } }
    const context = { environment, emitFile: vi.fn(() => 'asset0') }
    const buildStart = plugin.buildStart as (this: unknown) => void
    buildStart.call(context)
    await load.call(context, path.join(root, 'sample.bin') + '?asset')
    await load.call(context, path.join(root, 'sample.bin') + '?asset&asarUnpack')
    expect(context.emitFile).toHaveBeenCalledTimes(1)
  })
})
