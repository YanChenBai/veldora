import path from 'node:path'
import fs from 'node:fs'
import type { TypegenOptions } from '../config'
import { TYPEGEN_DIR, VELDORA_DIR } from './constants'
import { resolveTypegenEntries } from './entries'
import { buildDeclarations, watchDeclarations, type TypegenWatcher } from './pack'
import { writeTypegenTsconfig } from './tsconfig'
import { writeTypePackageIndex } from './package'

export interface TypegenController {
  close(): Promise<void>
}

function resolveOutDir(root: string): string {
  return path.resolve(root, VELDORA_DIR, TYPEGEN_DIR)
}

function ensureVeldoraDir(root: string): void {
  fs.mkdirSync(path.resolve(root, VELDORA_DIR), { recursive: true })
}

/**
 * Perform a one-shot declaration generation for the configured typegen
 * entries. Resolves once `.veldora/types` and `.veldora/tsconfig.json` have
 * been fully written.
 */
export async function generateTypes(typegen: TypegenOptions, root: string): Promise<void> {
  const entries = resolveTypegenEntries(typegen, root)
  const outDir = resolveOutDir(root)

  ensureVeldoraDir(root)
  writeTypegenTsconfig(root)
  await buildDeclarations({ entries, outDir, root, dts: typegen.dts })
  writeTypePackageIndex(root, entries)
}

/**
 * Start a declaration watcher for the configured typegen entries. Callers
 * should run {@link generateTypes} first so an initial declaration set exists
 * before other targets start. Close the controller on shutdown.
 */
export async function watchTypes(
  typegen: TypegenOptions,
  root: string
): Promise<TypegenController> {
  const entries = resolveTypegenEntries(typegen, root)
  const outDir = resolveOutDir(root)

  ensureVeldoraDir(root)
  writeTypegenTsconfig(root)

  const watcher: TypegenWatcher = await watchDeclarations({
    entries,
    outDir,
    root,
    dts: typegen.dts
  })

  // The watcher performs a one-time `clean` of the output directory when it
  // starts, so regenerate the root `index.d.ts` afterwards.
  writeTypePackageIndex(root, entries)

  return {
    async close(): Promise<void> {
      await watcher.close()
    }
  }
}
