import type { Plugin } from 'vite'
import { TYPEGEN_PACKAGE } from '../typegen/constants'

function isTypegenModule(id: string): boolean {
  return id === TYPEGEN_PACKAGE || id.startsWith(`${TYPEGEN_PACKAGE}/`)
}

/**
 * Guard against runtime imports of the generated `veldora-types` module.
 *
 * The module is type-only: `import type` statements are erased by the bundler
 * before resolution, so only runtime imports reach `resolveId` and fail here.
 */
export function typegenGuardPlugin(): Plugin {
  return {
    name: 'veldora:typegen-guard',
    enforce: 'pre',
    resolveId(id) {
      if (isTypegenModule(id)) {
        throw new Error(
          `[veldora:typegen] "${id}" is type-only and cannot be imported at runtime.\n\n` +
            `Use:\n\n` +
            `  import type { ... } from '${id}'`
        )
      }
    }
  }
}
