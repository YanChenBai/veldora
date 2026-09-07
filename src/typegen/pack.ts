import fs from 'node:fs'
import path from 'node:path'
import type { DtsOptions, UserConfig } from 'vite-plus/pack'

export interface TypegenPackOptions {
  entries: Record<string, string>
  outDir: string
  root: string
  dts?: Omit<DtsOptions, 'emitDtsOnly'>
}

export interface TypegenWatcher {
  close(): Promise<void>
}

function resolvePackConfig(options: TypegenPackOptions): UserConfig {
  // `emitDtsOnly` is always enforced: `veldora-types` is a type-only
  // package and must never emit runtime chunks into `.veldora/types`.
  const dts: DtsOptions = { ...options.dts, emitDtsOnly: true }

  // `tsc -b` is required to resolve `references` in the project tsconfig;
  // enable it automatically unless the user overrides it explicitly.
  if (dts.build === undefined && hasProjectReferences(options.root)) {
    dts.build = true
  }

  return {
    entry: options.entries,
    outDir: options.outDir,
    format: 'esm',
    platform: 'neutral',
    fixedExtension: false,
    clean: true,
    dts,
    // Force a stable `.d.ts` extension regardless of the project's
    // `package.json` `type` field.
    outExtensions: () => ({ dts: '.d.ts' }),
    cwd: options.root,
    logLevel: 'warn'
  }
}

function hasProjectReferences(root: string): boolean {
  try {
    const tsconfig = JSON.parse(fs.readFileSync(path.resolve(root, 'tsconfig.json'), 'utf8'))
    return Array.isArray(tsconfig.references) && tsconfig.references.length > 0
  } catch {
    return false
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
