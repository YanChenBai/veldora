import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import colors from 'picocolors'
import {
  type UserConfig as ViteConfig,
  type ConfigEnv,
  type PluginOption,
  type Plugin,
  type BuildEnvironmentOptions as ViteBuildOptions,
  type LogLevel,
  createLogger,
  mergeConfig,
  normalizePath
} from 'vite'
import { build } from 'esbuild'

import {
  electronMainConfigPresetPlugin,
  electronMainConfigValidatorPlugin,
  electronPreloadConfigPresetPlugin,
  electronPreloadConfigValidatorPlugin,
  electronRendererConfigPresetPlugin,
  electronRendererConfigValidatorPlugin
} from './plugins/electron'
import assetPlugin from './plugins/asset'
import workerPlugin from './plugins/worker'
import importMetaPlugin from './plugins/importMeta'
import esmShimPlugin from './plugins/esmShim'
import modulePathPlugin from './plugins/modulePath'
import isolateEntriesPlugin from './plugins/isolateEntries'
import { type ExternalOptions, externalizeDepsPlugin } from './plugins/externalizeDeps'
import { type BytecodeOptions, bytecodePlugin } from './plugins/bytecode'
import { isObject, isFilePathESM, deepClone, asyncFlatten } from './utils'

export { defineConfig as defineViteConfig } from 'vite'

interface IsolatedEntriesMixin {
  /**
   * Build each entry point as an isolated bundle without code splitting.
   *
   * When enabled, each entry will include all its dependencies inline,
   * preventing automatic code splitting across entries and ensuring each
   * output file is fully standalone.
   *
   * **Important**: When using `isolatedEntries` in `preload` config, you
   * should also disable `build.externalizeDeps` to ensure third-party dependencies
   * from `node_modules` are bundled together, which is required for Electron
   * sandbox support.
   *
   * @experimental
   * @default false
   */
  isolatedEntries?: boolean
}

interface ExternalizeDepsMixin {
  /**
   * Options pass on to `externalizeDeps` plugin in veldora.
   *
   * Automatically externalize dependencies.
   *
   * @default true
   */
  externalizeDeps?: boolean | ExternalOptions
}

interface BytecodeMixin {
  /**
   * Options pass on to `bytecode` plugin in veldora.
   * https://electron-vite.org/guide/source-code-protection#options
   *
   * Compile source code to v8 bytecode.
   */
  bytecode?: boolean | BytecodeOptions
}

interface MainBuildOptions extends ViteBuildOptions, ExternalizeDepsMixin, BytecodeMixin {}

interface PreloadBuildOptions
  extends ViteBuildOptions, ExternalizeDepsMixin, BytecodeMixin, IsolatedEntriesMixin {}

interface RendererBuildOptions extends ViteBuildOptions, IsolatedEntriesMixin {}

export type ResolveOptions = NonNullable<ViteConfig['resolve']> & {
  /**
   * Enable native resolution of compiler paths from tsconfig files.
   *
   * @see https://viteplus.dev/
   */
  tsconfigPaths?: boolean
}

interface BaseViteConfig<T> extends Omit<ViteConfig, 'build' | 'resolve'> {
  /**
   * Resolve options, including Vite+ extensions.
   */
  resolve?: ResolveOptions
  /**
   * Build specific options
   */
  build?: T
}

export interface MainViteConfig extends BaseViteConfig<MainBuildOptions> {}

export interface PreloadViteConfig extends BaseViteConfig<PreloadBuildOptions> {}

export interface RendererViteConfig extends BaseViteConfig<RendererBuildOptions> {}

export interface ElectronConfig {
  /**
   * Vite config options for electron main process
   *
   * @see https://vitejs.dev/config/
   */
  main?: MainViteConfig
  /**
   * Vite config options for electron renderer process
   *
   * @see https://vitejs.dev/config/
   */
  renderer?: RendererViteConfig
  /**
   * Vite config options for electron preload scripts
   *
   * @see https://vitejs.dev/config/
   */
  preload?: PreloadViteConfig
}

export interface UserConfig {
  /**
   * Shared resolve options for the electron main, preload and renderer processes.
   *
   * This includes Vite+ resolve extensions such as `resolve.tsconfigPaths` when
   * the project uses Vite+ as its Vite implementation.
   */
  resolve?: ResolveOptions
  /**
   * Vite config options for the electron main, preload and renderer processes.
   */
  electron?: ElectronConfig
}

export type ElectronViteConfigFnObject = (env: ConfigEnv) => UserConfig
export type ElectronViteConfigFnPromise = (env: ConfigEnv) => Promise<UserConfig>
export type ElectronViteConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>

export type ElectronViteConfigExport =
  | UserConfig
  | Promise<UserConfig>
  | ElectronViteConfigFnObject
  | ElectronViteConfigFnPromise
  | ElectronViteConfigFn

/**
 * Type helper to make it easier to use `vite.config.*` or `veldora.config.*`
 * accepts a direct {@link UserConfig} object, or a function that returns it.
 * The function receives a object that exposes two properties:
 * `command` (either `'build'` or `'serve'`), and `mode`.
 */
export function defineConfig(config: UserConfig): UserConfig
export function defineConfig(config: Promise<UserConfig>): Promise<UserConfig>
export function defineConfig(config: ElectronViteConfigFnObject): ElectronViteConfigFnObject
export function defineConfig(config: ElectronViteConfigFnPromise): ElectronViteConfigFnPromise
export function defineConfig(config: ElectronViteConfigExport): ElectronViteConfigExport
export function defineConfig(config: ElectronViteConfigExport): ElectronViteConfigExport {
  return config
}

export type InlineConfig = Omit<ViteConfig, 'base'> & {
  configFile?: string | false
  envFile?: false
  ignoreConfigWarning?: boolean
}

export interface ResolvedConfig {
  config?: UserConfig
  configFile?: string
  configFileDependencies: string[]
}

export async function resolveConfig(
  inlineConfig: InlineConfig,
  command: 'build' | 'serve',
  defaultMode = 'development'
): Promise<ResolvedConfig> {
  const config = inlineConfig
  const mode = inlineConfig.mode || defaultMode

  process.env.NODE_ENV = defaultMode

  const userConfig: UserConfig | undefined = {}

  let configFileDependencies: string[] = []

  let { configFile } = config
  if (configFile !== false) {
    const configEnv = {
      mode,
      command
    }

    const loadResult = await loadConfigFromFile(
      configEnv,
      configFile,
      config.root,
      config.logLevel,
      config.ignoreConfigWarning
    )

    if (loadResult) {
      const root = config.root
      delete config.root
      delete config.configFile

      config.configFile = false

      const outDir = config.build?.outDir

      const { resolve, electron } = loadResult.config
      const { main, preload, renderer } = electron || {}

      const electronConfig: ElectronConfig = {}

      if (main) {
        electronConfig.main = await new MainConfigFactory(
          mergeSharedResolve(resolve, main),
          config,
          {
            outDir,
            root
          }
        ).build()
      }

      if (preload) {
        electronConfig.preload = await new PreloadConfigFactory(
          mergeSharedResolve(resolve, preload),
          config,
          {
            outDir,
            root
          }
        ).build()
      }

      if (renderer) {
        electronConfig.renderer = await new RendererConfigFactory(
          mergeSharedResolve(resolve, renderer),
          config,
          {
            outDir,
            root
          }
        ).build()
      }

      userConfig.electron = electronConfig

      configFile = loadResult.path
      configFileDependencies = loadResult.dependencies
    }
  }

  const resolved: ResolvedConfig = {
    config: userConfig,
    configFile: configFile ? normalizePath(configFile) : undefined,
    configFileDependencies
  }

  return resolved
}

function mergeSharedResolve<T extends MainViteConfig | PreloadViteConfig | RendererViteConfig>(
  resolve: ResolveOptions | undefined,
  targetConfig: T
): T {
  return resolve ? (mergeConfig({ resolve }, targetConfig as ViteConfig) as T) : targetConfig
}

export abstract class ConfigFactory<
  T extends MainViteConfig | PreloadViteConfig | RendererViteConfig
> {
  constructor(
    protected readonly baseConfig: T,
    protected readonly inlineConfig: InlineConfig,
    protected readonly options: { outDir?: string; root?: string }
  ) {
    baseConfig.build ??= {}
    baseConfig.build.rolldownOptions ??= baseConfig.build.rollupOptions
  }

  async build(cleanMode?: boolean): Promise<T> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const config = mergeConfig(deepClone(this.baseConfig) as any, deepClone(this.inlineConfig)) as T

    config.mode = this.inlineConfig.mode || config.mode || process.env.NODE_ENV

    if (this.options.outDir) {
      resetOutDir(config, this.options.outDir, this.processType())
    }

    const builtinPlugins = await this.resolveBuiltinPlugins(config, cleanMode)

    config.plugins = builtinPlugins.concat(config.plugins || [])

    return config
  }

  protected abstract processType(): 'main' | 'preload' | 'renderer'

  protected abstract resolveBuiltinPlugins(config: T, cleanMode?: boolean): Promise<PluginOption[]>
}

export class MainConfigFactory extends ConfigFactory<MainViteConfig> {
  protected processType(): 'main' {
    return 'main'
  }

  protected async resolveBuiltinPlugins(
    config: MainViteConfig,
    cleanMode?: boolean
  ): Promise<PluginOption[]> {
    const configDrivenPlugins: PluginOption[] = await resolveConfigDrivenPlugins(config)

    return cleanMode
      ? [
          electronMainConfigPresetPlugin({ root: this.options.root }),
          assetPlugin(),
          importMetaPlugin(),
          esmShimPlugin(),
          ...configDrivenPlugins
        ]
      : [
          electronMainConfigPresetPlugin({ root: this.options.root }),
          electronMainConfigValidatorPlugin(),
          assetPlugin(),
          workerPlugin(),
          modulePathPlugin(this),
          importMetaPlugin(),
          esmShimPlugin(),
          ...configDrivenPlugins
        ]
  }
}

export class PreloadConfigFactory extends ConfigFactory<PreloadViteConfig> {
  protected processType(): 'preload' {
    return 'preload'
  }

  protected async resolveBuiltinPlugins(
    config: PreloadViteConfig,
    cleanMode?: boolean
  ): Promise<PluginOption[]> {
    const configDrivenPlugins: PluginOption[] = await resolveConfigDrivenPlugins(config)

    return cleanMode
      ? [
          electronPreloadConfigPresetPlugin({ root: this.options.root }),
          assetPlugin(),
          importMetaPlugin(),
          esmShimPlugin(),
          ...configDrivenPlugins
        ]
      : [
          electronPreloadConfigPresetPlugin({ root: this.options.root }),
          electronPreloadConfigValidatorPlugin(),
          assetPlugin(),
          importMetaPlugin(),
          esmShimPlugin(),
          ...configDrivenPlugins,
          ...(config.build?.isolatedEntries ? [isolateEntriesPlugin(this)] : [])
        ]
  }
}

export class RendererConfigFactory extends ConfigFactory<RendererViteConfig> {
  protected processType(): 'renderer' {
    return 'renderer'
  }

  protected async resolveBuiltinPlugins(
    config: RendererViteConfig,
    cleanMode?: boolean
  ): Promise<PluginOption[]> {
    return cleanMode
      ? [electronRendererConfigPresetPlugin({ root: this.options.root })]
      : [
          electronRendererConfigPresetPlugin({ root: this.options.root }),
          electronRendererConfigValidatorPlugin(),
          ...(config.build?.isolatedEntries ? [isolateEntriesPlugin(this)] : [])
        ]
  }
}

function resetOutDir(config: ViteConfig, outDir: string, subOutDir: string): void {
  let userOutDir = config.build?.outDir
  if (outDir === userOutDir) {
    userOutDir = path.resolve(config.root || process.cwd(), outDir, subOutDir)
    if (config.build) {
      config.build.outDir = userOutDir
    } else {
      config.build = { outDir: userOutDir }
    }
  }
}

async function resolveConfigDrivenPlugins(
  config: MainViteConfig | PreloadViteConfig
): Promise<PluginOption[]> {
  const userPlugins = (await asyncFlatten(config.plugins || [])).filter(Boolean) as Plugin[]

  const configDrivenPlugins: PluginOption[] = []

  const hasExternalizeDepsPlugin = userPlugins.some((p) => p.name === 'vite:externalize-deps')
  if (!hasExternalizeDepsPlugin) {
    const externalOptions = config.build?.externalizeDeps ?? true
    if (externalOptions) {
      if (isOptions<ExternalOptions>(externalOptions)) {
        configDrivenPlugins.push(externalizeDepsPlugin(externalOptions))
      } else {
        configDrivenPlugins.push(externalizeDepsPlugin())
      }
    }
  }

  const hasBytecodePlugin = userPlugins.some((p) => p.name === 'vite:bytecode')
  if (!hasBytecodePlugin) {
    const bytecodeOptions = config.build?.bytecode
    if (bytecodeOptions) {
      if (isOptions<BytecodeOptions>(bytecodeOptions)) {
        configDrivenPlugins.push(bytecodePlugin(bytecodeOptions))
      } else {
        configDrivenPlugins.push(bytecodePlugin())
      }
    }
  }

  return configDrivenPlugins
}

function isOptions<T extends object>(value: boolean | T): value is T {
  return typeof value === 'object' && value !== null
}

const CONFIG_FILE_NAME = 'veldora.config'
const VITE_CONFIG_FILE_NAME = 'vite.config'

export async function loadConfigFromFile(
  configEnv: ConfigEnv,
  configFile?: string,
  configRoot: string = process.cwd(),
  logLevel?: LogLevel,
  ignoreConfigWarning = false
): Promise<{
  path: string
  config: UserConfig
  dependencies: string[]
}> {
  const resolvedPath = configFile
    ? path.resolve(configFile)
    : findConfigFile(
        configRoot,
        [CONFIG_FILE_NAME, VITE_CONFIG_FILE_NAME],
        ['js', 'ts', 'mjs', 'cjs', 'mts', 'cts']
      )

  if (!resolvedPath) {
    return {
      path: '',
      config: { electron: { main: {}, preload: {}, renderer: {} } },
      dependencies: []
    }
  }

  const isESM = isFilePathESM(resolvedPath)

  try {
    const { code, dependencies } = await bundleConfigFile(resolvedPath, isESM)
    const configExport = await loadConfigFormBundledFile(configRoot, resolvedPath, code, isESM)

    const config = await (typeof configExport === 'function'
      ? configExport(configEnv)
      : configExport)
    if (!isObject(config)) {
      throw new Error(`config must export or return an object`)
    }

    if (!ignoreConfigWarning) {
      const missingFields = ['main', 'renderer', 'preload'].filter(
        (field) => !config.electron?.[field]
      )
      if (missingFields.length > 0) {
        createLogger(logLevel).warn(
          `${colors.yellow(colors.bold('(!)'))} ${colors.yellow(`${missingFields.join(' and ')} config is missing`)}\n`
        )
      }
    }

    return {
      path: normalizePath(resolvedPath),
      config,
      dependencies
    }
  } catch (e) {
    createLogger(logLevel).error(colors.red(`failed to load config from ${resolvedPath}`), {
      error: e as Error
    })
    throw e
  }
}

function findConfigFile(configRoot: string, names: string[], extensions: string[]): string {
  for (const name of names) {
    for (const ext of extensions) {
      const configFile = path.resolve(configRoot, `${name}.${ext}`)
      if (fs.existsSync(configFile)) {
        return configFile
      }
    }
  }
  return ''
}

async function bundleConfigFile(
  fileName: string,
  isESM: boolean
): Promise<{ code: string; dependencies: string[] }> {
  const dirnameVarName = '__veldora_injected_dirname'
  const filenameVarName = '__veldora_injected_filename'
  const importMetaUrlVarName = '__veldora_injected_import_meta_url'
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [fileName],
    write: false,
    target: ['node20'],
    platform: 'node',
    bundle: true,
    format: isESM ? 'esm' : 'cjs',
    sourcemap: false,
    metafile: true,
    define: {
      __dirname: dirnameVarName,
      __filename: filenameVarName,
      'import.meta.url': importMetaUrlVarName
    },
    plugins: [
      {
        name: 'externalize-deps',
        setup(build): void {
          build.onResolve({ filter: /.*/ }, (args) => {
            const id = args.path
            if (id[0] !== '.' && !path.isAbsolute(id)) {
              return {
                external: true
              }
            }
            return null
          })
        }
      },
      {
        name: 'replace-import-meta',
        setup(build): void {
          build.onLoad({ filter: /\.[cm]?[jt]s$/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf8')
            const injectValues =
              `const ${dirnameVarName} = ${JSON.stringify(path.dirname(args.path))};` +
              `const ${filenameVarName} = ${JSON.stringify(args.path)};` +
              `const ${importMetaUrlVarName} = ${JSON.stringify(pathToFileURL(args.path).href)};`

            return {
              loader: args.path.endsWith('ts') ? 'ts' : 'js',
              contents: injectValues + contents
            }
          })
        }
      }
    ]
  })
  const { text } = result.outputFiles[0]
  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : []
  }
}

interface NodeModuleWithCompile extends NodeModule {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  _compile(code: string, filename: string): any
}

const _require = createRequire(import.meta.url)
async function loadConfigFormBundledFile(
  configRoot: string,
  configFile: string,
  bundledCode: string,
  isESM: boolean
): Promise<ElectronViteConfigExport> {
  if (isESM) {
    const fileNameTmp = path.resolve(configRoot, `${CONFIG_FILE_NAME}.${Date.now()}.mjs`)
    fs.writeFileSync(fileNameTmp, bundledCode)

    const fileUrl = pathToFileURL(fileNameTmp)
    try {
      return (await import(fileUrl.href)).default
    } finally {
      try {
        fs.unlinkSync(fileNameTmp)
      } catch {}
    }
  } else {
    const extension = path.extname(configFile)
    const realFileName = fs.realpathSync(configFile)
    const loaderExt = extension in _require.extensions ? extension : '.js'
    const defaultLoader = _require.extensions[loaderExt]!
    _require.extensions[loaderExt] = (module: NodeModule, filename: string): void => {
      if (filename === realFileName) {
        ;(module as NodeModuleWithCompile)._compile(bundledCode, filename)
      } else {
        defaultLoader(module, filename)
      }
    }
    delete _require.cache[_require.resolve(configFile)]
    const raw = _require(configFile)
    _require.extensions[loaderExt] = defaultLoader
    return raw.__esModule ? raw.default : raw
  }
}
