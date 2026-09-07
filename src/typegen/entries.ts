import path from 'node:path'
import fs from 'node:fs'
import type { TypegenOptions } from '../config'

const ENTRY_NAME_RE = /^[A-Za-z0-9._-]+$/

/**
 * Validate typegen entry names and resolve their source paths to absolute
 * paths relative to the project root.
 *
 * @throws When an entry name is invalid or its source path does not exist.
 */
export function resolveTypegenEntries(
  typegen: TypegenOptions,
  root: string
): Record<string, string> {
  const entries = typegen.entries || {}

  return Object.fromEntries(
    Object.entries(entries).map(([name, source]) => {
      if (!ENTRY_NAME_RE.test(name)) {
        throw new Error(
          `[veldora:typegen] Invalid entry name "${name}".\n\n` +
            `Entry names may only contain letters, numbers, ".", "_" and "-".`
        )
      }

      const resolved = path.isAbsolute(source) ? source : path.resolve(root, source)

      if (!fs.existsSync(resolved)) {
        throw new Error(`[veldora:typegen] Entry "${name}" does not exist:\n\n${source}`)
      }

      return [name, resolved]
    })
  )
}
