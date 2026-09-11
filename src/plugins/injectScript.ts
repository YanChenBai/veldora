import { type Plugin, parseSync, transformWithOxc } from 'vite'
import MagicString from 'magic-string'
import { getElectronChromeTarget } from '../electron'
import { cleanUrl } from '../utils'

const injectRE = /(?:\?|&)inject(?:&|$)/

const ENTRY_NAME = '__veldora_inject_script_entry__'
const RUNTIME_HELPERS_PREFIX = '@oxc-project/runtime'

const MODULE_SYNTAX_MESSAGE = 'cannot contain runtime imports or named exports'

interface Node {
  type: string
  start: number
  end: number
}

interface ExportDefaultDeclarationNode extends Node {
  type: 'ExportDefaultDeclaration'
  declaration: Node
}

interface ExportSpecifierNode extends Node {
  type: 'ExportSpecifier'
  local: { name: string }
  exported: { name?: string; value?: string }
}

interface ExportNamedDeclarationNode extends Node {
  type: 'ExportNamedDeclaration'
  declaration: Node | null
  source: Node | null
  specifiers: ExportSpecifierNode[]
}

interface ImportDeclarationNode extends Node {
  type: 'ImportDeclaration'
  source: { value: string }
}

function containsDynamicImport(node: unknown): boolean {
  let found = false

  const visit = (current: unknown): void => {
    if (found || !current || typeof current !== 'object') {
      return
    }
    if (Array.isArray(current)) {
      for (const child of current) {
        visit(child)
      }
      return
    }

    const record = current as Record<string, unknown>
    if (record.type === 'ImportExpression') {
      found = true
      return
    }

    for (const key of Object.keys(record)) {
      if (key === 'parent') {
        continue
      }
      visit(record[key])
    }
  }

  visit(node)
  return found
}

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
        // The emitted script runs in the renderer via `webContents.executeJavaScript`,
        // so it must target the Chromium version bundled with the detected Electron.
        target: getElectronChromeTarget() || 'esnext',
        sourceType: 'module',
        sourcemap: false
      })

      const { program, errors } = parseSync(filename, transformed.code, {
        sourceType: 'module'
      })
      if (errors.length > 0) {
        this.error(`[vite:inject] ${filename} failed to parse: ${errors[0].message}`)
      }

      let defaultExport:
        | { kind: 'declaration'; node: ExportDefaultDeclarationNode }
        | { kind: 'specifier'; node: ExportNamedDeclarationNode; local: string }
        | null = null

      for (const node of program.body as unknown as Node[]) {
        if (node.type === 'ImportDeclaration') {
          const { source: importSource } = node as ImportDeclarationNode
          if (importSource.value.startsWith(RUNTIME_HELPERS_PREFIX)) {
            this.error(
              `[vite:inject] ${filename} requires the runtime helper "${importSource.value}", which is not supported in standalone inject modules`
            )
          }
          this.error(`[vite:inject] ${filename} ${MODULE_SYNTAX_MESSAGE}`)
        }

        if (node.type === 'ExportAllDeclaration') {
          this.error(`[vite:inject] ${filename} ${MODULE_SYNTAX_MESSAGE}`)
        }

        if (node.type === 'ExportNamedDeclaration') {
          const named = node as ExportNamedDeclarationNode
          const [specifier] = named.specifiers
          const isDefaultSpecifier =
            named.specifiers.length === 1 && specifier.exported.name === 'default'

          if (named.declaration || named.source || !isDefaultSpecifier) {
            this.error(`[vite:inject] ${filename} ${MODULE_SYNTAX_MESSAGE}`)
          }
          if (defaultExport) {
            this.error(`[vite:inject] ${filename} must have exactly one default export`)
          }
          defaultExport = { kind: 'specifier', node: named, local: specifier.local.name }
          continue
        }

        if (node.type === 'ExportDefaultDeclaration') {
          if (defaultExport) {
            this.error(`[vite:inject] ${filename} must have exactly one default export`)
          }
          defaultExport = { kind: 'declaration', node: node as ExportDefaultDeclarationNode }
        }
      }

      if (!defaultExport) {
        this.error(`[vite:inject] ${filename} must have a default export`)
      }

      if (containsDynamicImport(program)) {
        this.error(`[vite:inject] ${filename} ${MODULE_SYNTAX_MESSAGE}`)
      }

      const s = new MagicString(transformed.code)
      if (defaultExport.kind === 'declaration') {
        // `export default <expr>` -> `const <entry> = <expr>`
        // A named function/class declaration becomes an expression, so it loses its
        // outer binding; that only matters if later code references it, which the
        // standalone-module contract does not allow anyway.
        s.overwrite(
          defaultExport.node.start,
          defaultExport.node.declaration.start,
          `const ${ENTRY_NAME} = `
        )
      } else {
        // `export { fn as default }` -> `const <entry> = fn`
        s.overwrite(
          defaultExport.node.start,
          defaultExport.node.end,
          `const ${ENTRY_NAME} = ${defaultExport.local}`
        )
      }

      const body = s.toString()
      if (body.includes(RUNTIME_HELPERS_PREFIX)) {
        this.error(
          `[vite:inject] ${filename} requires a runtime helper, which is not supported in standalone inject modules`
        )
      }

      const script = ['(async () => {', body, `return ${ENTRY_NAME}()`, '})()'].join('\n')

      return {
        code: `export default ${JSON.stringify(script)}`,
        map: null
      }
    }
  }
}
