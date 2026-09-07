import type { UserConfig } from 'vite-plus/pack'

export interface TypegenPackOptions {
  entries: Record<string, string>
  outDir: string
  root: string
}

export interface TypegenWatcher {
  close(): Promise<void>
}

function resolvePackConfig(options: TypegenPackOptions): UserConfig {
  return {
    entry: options.entries,
    outDir: options.outDir,
    format: 'esm',
    platform: 'neutral',
    fixedExtension: false,
    clean: true,
    dts: { emitDtsOnly: true },
    // Force a stable `.d.ts` extension regardless of the project's
    // `package.json` `type` field.
    outExtensions: () => ({ dts: '.d.ts' }),
    cwd: options.root,
    logLevel: 'warn'
  }
}

/**
 * Extract declarations from the configured entries into `.veldora/types` using
 * the Vite+ Pack (tsdown) DTS pipeline. Resolves once all declarations have
 * been written.
 */
export async function buildDeclarations(options: TypegenPackOptions): Promise<void> {
  const { build } = await import('vite-plus/pack')
  await build(resolvePackConfig(options))
}

/**
 * Start a declaration watcher backed by Vite+ Pack. The returned promise
 * resolves once the watcher has been started; close it with
 * {@link TypegenWatcher.close}.
 */
export async function watchDeclarations(options: TypegenPackOptions): Promise<TypegenWatcher> {
  const { build } = await import('vite-plus/pack')

  const bundles = await build({
    ...resolvePackConfig(options),
    watch: true
  })

  return {
    async close(): Promise<void> {
      await Promise.all(bundles.map((bundle) => bundle[Symbol.asyncDispose]()))
    }
  }
}
