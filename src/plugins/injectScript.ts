import { type Plugin, parseSync, transformWithOxc } from 'vite'
import MagicString from 'magic-string'
import { getElectronChromeTarget } from '../electron'
import { cleanUrl } from '../utils'

const injectRE = /(?:\?|&)inject(?:&|$)/

const ENTRY_NAME = '__veldora_inject_script_entry__'
const RUNTIME_HELPERS_PREFIX = '@oxc-project/runtime'

const MODULE_SYNTAX_MESSAGE = 'cannot contain runtime imports or named exports'
const IMPORT_META_MESSAGE = 'cannot use "import.meta", which is unavailable in a classic script'
const NOT_CALLABLE_MESSAGE =
  'must default-export a function, because the generated script invokes it'

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

/**
 * Returns the error message for the first construct that cannot survive as a
 * standalone classic script, or `null` when the module is valid.
 *
 * `import()` needs a bundler to resolve, and `import.meta` — a `MetaProperty` on
 * the Oxc version in use, an `ImportMeta` node on newer ones — is a syntax error
 * outside a module.
 */
function findUnsupportedSyntax(node: unknown): string | null {
  let message: string | null = null

  const visit = (current: unknown): void => {
    if (message || !current || typeof current !== 'object') {
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
      message = MODULE_SYNTAX_MESSAGE
      return
    }

    const meta = record.meta as { name?: string } | undefined
    if (
      record.type === 'ImportMeta' ||
      (record.type === 'MetaProperty' && meta?.name === 'import')
    ) {
      message = IMPORT_META_MESSAGE
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
  return message
}

/** Returns the name a default-exported declaration binds, if it has one. */
function getDeclaredName(node: Node): string | null {
  if (node.type !== 'FunctionDeclaration' && node.type !== 'ClassDeclaration') {
    return null
  }
  return (node as { id?: { name: string } | null }).id?.name ?? null
}

/** Strips the wrappers that hold no runtime value of their own. */
function unwrapExportExpression(node: Node): Node {
  let current = node
  for (;;) {
    if (
      current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression'
    ) {
      const inner = (current as { expression?: Node }).expression
      if (!inner) {
        return current
      }
      current = inner
      continue
    }
    return current
  }
}

/**
 * Describes a default export whose value cannot be called, or `null` when it
 * still might be.
 *
 * The generated wrapper invokes the default export, so a value that is
 * statically known to be non-callable can only fail later inside the renderer,
 * with a `TypeError` pointing at the emitted script instead of the module.
 *
 * This is necessarily best-effort: identifiers, member access, and calls can
 * resolve to anything and stay allowed. `export { fn as default }` is left
 * alone as well, because resolving `fn` would require binding tracking.
 */
function findNonCallableExport(declaration: Node): string | null {
  const node = unwrapExportExpression(declaration)

  switch (node.type) {
    case 'ClassDeclaration':
    case 'ClassExpression':
      return 'a class'
    case 'ObjectExpression':
      return 'an object literal'
    case 'ArrayExpression':
      return 'an array literal'
    case 'Literal':
      // Oxc folds numbers, strings, booleans, null, bigint, and regular
      // expressions into a single node type.
      return 'a literal value'
    case 'TemplateLiteral':
      // A tagged template calls a function, so only untagged ones are strings.
      return (node as { tag?: unknown }).tag ? null : 'a template literal'
    default:
      return null
  }
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

      if (defaultExport.kind === 'declaration') {
        const nonCallable = findNonCallableExport(defaultExport.node.declaration)
        if (nonCallable) {
          this.error(
            `[vite:inject] ${filename} ${NOT_CALLABLE_MESSAGE} (the default export is ${nonCallable})`
          )
        }
      }

      const unsupported = findUnsupportedSyntax(program)
      if (unsupported) {
        this.error(`[vite:inject] ${filename} ${unsupported}`)
      }

      const s = new MagicString(transformed.code)
      // The generated wrapper invokes this binding to run the default export.
      let entryName = ENTRY_NAME
      if (defaultExport.kind === 'declaration') {
        const { declaration } = defaultExport.node
        const declaredName = getDeclaredName(declaration)
        if (declaredName) {
          // `export default function fn() {}` -> `function fn() {}`
          // Keeping the declaration instead of turning it into an expression leaves
          // `fn` bound in module scope, so hoisted and later references still resolve.
          s.remove(defaultExport.node.start, declaration.start)
          entryName = declaredName
        } else {
          // `export default <expr>`, including anonymous function and class
          // declarations -> `const <entry> = <expr>`
          s.overwrite(defaultExport.node.start, declaration.start, `const ${ENTRY_NAME} = `)
        }
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

      const script = ['(async () => {', body, `return ${entryName}()`, '})()'].join('\n')

      return {
        code: `export default ${JSON.stringify(script)}`,
        map: null
      }
    }
  }
}
