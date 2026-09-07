import path from 'node:path'
import fs from 'node:fs'
import { TYPEGEN_DIR, VELDORA_DIR } from './constants'

/**
 * Write the root `index.d.ts` which re-exports every entry declaration using
 * type-only re-exports, so `import type { Foo } from 'veldora-types'` resolves
 * the full public surface.
 */
export function writeTypePackageIndex(root: string, entries: Record<string, string>): void {
  const lines = Object.keys(entries).map((name) => `export type * from './${name}'`)

  const content = `${lines.join('\n')}\n`
  const file = path.resolve(root, VELDORA_DIR, TYPEGEN_DIR, 'index.d.ts')

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
