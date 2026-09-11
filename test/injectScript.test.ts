import { describe, expect, it, vi } from 'vite-plus/test'
import injectScriptPlugin from '../src/plugins/injectScript'

vi.mock('../src/electron', async (importOriginal: <T>() => Promise<T>) => ({
  ...(await importOriginal<typeof import('../src/electron')>()),
  // Pin the target to a low Chromium version so the lowering is observable.
  // Real versions resolve to chrome108+ where almost nothing is transpiled.
  getElectronChromeTarget: () => 'chrome60'
}))

interface TransformContext {
  error: (message: string) => never
}

const transform = injectScriptPlugin().transform as unknown as (
  this: TransformContext,
  code: string,
  id: string
) => Promise<{ code: string } | undefined>

const context: TransformContext = {
  error: (message: string): never => {
    throw new Error(message)
  }
}

const FILE_ID = '/project/src/get-user.ts?inject'

async function compile(source: string, id = FILE_ID): Promise<string> {
  const result = await transform.call(context, source, id)
  if (!result) {
    throw new Error('module was not transformed')
  }
  return JSON.parse(result.code.slice('export default '.length)) as string
}

/** Compiles the module and evaluates the emitted script, returning its resolved value. */
async function run(source: string): Promise<unknown> {
  const script = await compile(source)
  return await new Function(`return ${script}`)()
}

async function compileError(source: string): Promise<string> {
  try {
    await compile(source)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('expected the module to be rejected')
}

describe('injectScriptPlugin', () => {
  it('compiles a default-exported function into an executable script', async () => {
    const script = await compile('export default () => 42')
    expect(script).toContain('__veldora_inject_script_entry__')
    expect(await run('export default () => 42')).toBe(42)
  })

  it('supports local declarations alongside the default export', async () => {
    const source = [
      `const endpoint = 'https://example.com'`,
      `function normalize(value: string) { return value.trim() }`,
      `export default async () => normalize(endpoint)`
    ].join('\n')
    expect(await run(source)).toBe('https://example.com')
  })

  it('ignores modules that do not use the ?inject query', async () => {
    const result = await transform.call(context, 'export default 1', '/project/src/other.ts')
    expect(result).toBeUndefined()
  })

  it('keeps working when a string literal contains "export default"', async () => {
    const source = `const label = 'export default x'\nexport default () => label`
    expect(await run(source)).toBe('export default x')
  })

  it('keeps working when a comment contains "export default"', async () => {
    const source = `// export default placeholder\nexport default () => 1`
    expect(await run(source)).toBe(1)
  })

  it('supports "export { fn as default }"', async () => {
    const source = `const fn = () => 7\nexport { fn as default }`
    expect(await run(source)).toBe(7)
  })

  it('rejects runtime imports', async () => {
    const message = await compileError(`import x from 'x'\nexport default () => x`)
    expect(message).toContain('runtime imports')
  })

  it('rejects named exports that do not start a line', async () => {
    const source = `const a = 1; export { a }\nexport default () => 1`
    const message = await compileError(source)
    expect(message).toContain('named exports')
  })

  it('rejects dynamic import()', async () => {
    const message = await compileError(`export default () => import('x')`)
    expect(message).toContain('runtime imports')
  })

  it('rejects a module without a default export', async () => {
    const message = await compileError('const a = 1')
    expect(message).toContain('must have a default export')
  })

  it('rejects a module with more than one default export', async () => {
    const source = `export default () => 1\nexport default () => 2`
    const message = await compileError(source)
    expect(message).toContain('default export')
  })

  it('rejects syntax that requires a runtime helper', async () => {
    const source = `function f() {}\nusing x = f()\nexport default () => x`
    const message = await compileError(source)
    expect(message).toContain('runtime helper')
  })

  it('transpiles the script for the Electron renderer runtime', async () => {
    const script = await compile(`export default (value) => value ?? 1`)
    expect(script).not.toContain('??')
    expect(script).toContain('!== null &&')
    expect(script).not.toContain('@oxc-project/runtime')
  })
})
