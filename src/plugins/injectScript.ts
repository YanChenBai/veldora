import { type Plugin, transformWithOxc } from 'vite'
import { cleanUrl } from '../utils'

const injectRE = /(?:\?|&)inject(?:&|$)/
const defaultExportRE = /\bexport\s+default\b/
const moduleSyntaxRE = /^\s*(?:import\s+(?!\()|export\s+)/m

const ENTRY_NAME = '__veldora_inject_script_entry__'

export default function injectScriptPlugin(): Plugin {
  return {
    name: 'vite:inject-script',
    apply: 'build',
    enforce: 'pre',

    async transform(source, id) {
      if (id.startsWith('\0') || !injectRE.test(id)) {
        return
      }

      const filename = cleanUrl(id)

      const transformed = await transformWithOxc(source, filename, {
        target: 'esnext',
        sourcemap: false
      })

      if (!defaultExportRE.test(transformed.code)) {
        this.error(`[vite:inject] ${filename} must have a default export`)
      }

      const body = transformed.code.replace(defaultExportRE, `const ${ENTRY_NAME} =`)

      if (moduleSyntaxRE.test(body)) {
        this.error(`[vite:inject] ${filename} cannot contain runtime imports or named exports`)
      }

      const script = ['(async () => {', body, `return ${ENTRY_NAME}()`, '})()'].join('\n')

      return {
        code: `export default ${JSON.stringify(script)}`,
        map: null
      }
    }
  }
}
