import path from 'node:path'
import fs from 'node:fs'
import { TYPEGEN_DIR, TYPEGEN_PACKAGE, TYPEGEN_TSCONFIG_FILE, VELDORA_DIR } from './constants'

/**
 * Write the `.veldora/tsconfig.json` Veldora-generated TypeScript environment.
 *
 * It only registers the `veldora-types` and `veldora-types/*` path aliases so
 * that user projects can opt in via `extends` (or `references`) from their own
 * tsconfig. Veldora never touches the user's tsconfig.
 *
 * The write is idempotent: identical content is not rewritten, so tsserver /
 * Volar are not needlessly invalidated.
 */
export function writeTypegenTsconfig(root: string): void {
  const tsconfig = {
    compilerOptions: {
      paths: {
        [TYPEGEN_PACKAGE]: [`./${TYPEGEN_DIR}/index.d.ts`],
        [`${TYPEGEN_PACKAGE}/*`]: [`./${TYPEGEN_DIR}/*.d.ts`]
      }
    }
  }

  const content = `${JSON.stringify(tsconfig, null, 2)}\n`
  const file = path.resolve(root, VELDORA_DIR, TYPEGEN_TSCONFIG_FILE)

  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) {
    return
  }

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
