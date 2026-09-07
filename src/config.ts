import path from 'node:path'
import fs from 'node:fs'
import colors from 'picocolors'
import type { DtsOptions } from 'vite-plus/pack'
import {
  type UserConfig as ViteConfig,
  type ConfigEnv,
  type PluginOption,
  type BuildEnvironmentOptions as ViteBuildOptions,
  type LogLevel,
  createLogger,
  loadConfigFromFile as viteLoadConfigFromFile,
  mergeConfig,
  normalizePath
} from 'vite'

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
import { typegenGuardPlugin } from './plugins/typegenGuard'
import { deepClone } from './utils'

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

export type ConsoleFilter = (line: string) => boolean

export interface MainViteConfig extends BaseViteConfig<MainBuildOptions> {
  /**
   * Filter the Electron main process console output (stdout and stderr)
   * during development.
   *
   * Receives each line of output from the main process and return `true` to
   * suppress it. Useful for hiding noisy, non-actionable messages such as
   * Chromium's P2P/STUN address resolution errors.
   *
   * @example
   * ```ts
   * veldora: {
   *   main: {
   *     filterConsole: (line) => line.includes('Failed to resolve address')
   *   }
   * }
   * ```
   */
  filterConsole?: ConsoleFilter
}

export interface PreloadViteConfig extends BaseViteConfig<PreloadBuildOptions> {}

export interface RendererViteConfig extends BaseViteConfig<RendererBuildOptions> {}

export interface TypegenOptions {
  /**
   * TypeScript entry points whose declarations are extracted into the
   * `veldora-types` package.
   *
   * Each key becomes a subpath of `veldora-types` (e.g. `ipc` resolves to
   * `veldora-types/ipc`), and each value is a path to a source entry relative
   * to the project root.
   *
   * @example
   * ```ts
   * typegen: {
   *   entries: {
   *     ipc: 'src/main/ipc.ts',
   *     services: 'src/main/services.ts'
   *   }
   * }
   * ```
   */
  entries: Record<string, string>
  /**
   * Options passed through to the rolldown-plugin-dts declaration pipeline
   * used to generate `veldora-types`. Overrides the defaults Veldora applies.
   *
   * `emitDtsOnly` is always enabled and cannot be overridden, since
   * `veldora-types` is a type-only package.
   *
   * @example
   * ```ts
   * typegen: {
   *   entries: { ipc: 'src/main/ipc.ts' },
   *   // Required when the project tsconfig uses `references`.
   *   dts: { build: true }
   * }
   * ```
   *
   * @see https://github.com/voidzero-dev/rolldown-plugin-dts
   */
  dts?: Omit<DtsOptions, 'emitDtsOnly'>
}

export interface VeldoraConfig {
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
  /**
   * Generate the `veldora-types` declaration package from the configured
   * TypeScript entries, so preload / renderer / main can consume shared types
   * via type-only imports.
   *
   * @see https://github.com/YanChenBai/veldora
   */
  typegen?: TypegenOptions
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
  veldora?: VeldoraConfig
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

      const { resolve, veldora } = loadResult.config
      const { main, preload, renderer, typegen } = veldora || {}

      const veldoraConfig: VeldoraConfig = {}

      if (main) {
        veldoraConfig.main = await new MainConfigFactory(
          mergeSharedResolve(resolve, main),
          config,
          {
            outDir,
            root,
            typegen: Boolean(typegen)
          }
        ).build()
      }

      if (preload) {
        veldoraConfig.preload = await new PreloadConfigFactory(
          mergeSharedResolve(resolve, preload),
          config,
          {
            outDir,
            root,
            typegen: Boolean(typegen)
          }
        ).build()
      }

      if (renderer) {
        veldoraConfig.renderer = await new RendererConfigFactory(
          mergeSharedResolve(resolve, renderer),
          config,
          {
            outDir,
            root,
            typegen: Boolean(typegen)
          }
        ).build()
      }

      if (typegen) {
        veldoraConfig.typegen = typegen
      }

      userConfig.veldora = veldoraConfig

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
    protected readonly options: { outDir?: string; root?: string; typegen?: boolean }
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
          ...configDrivenPlugins,
          ...(this.options.typegen ? [typegenGuardPlugin()] : [])
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
          ...configDrivenPlugins,
          ...(this.options.typegen ? [typegenGuardPlugin()] : [])
        ]
      : [
          electronPreloadConfigPresetPlugin({ root: this.options.root }),
          electronPreloadConfigValidatorPlugin(),
          assetPlugin(),
          importMetaPlugin(),
          esmShimPlugin(),
          ...configDrivenPlugins,
          ...(config.build?.isolatedEntries ? [isolateEntriesPlugin(this)] : []),
          ...(this.options.typegen ? [typegenGuardPlugin()] : [])
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
      ? [
          electronRendererConfigPresetPlugin({ root: this.options.root }),
          ...(this.options.typegen ? [typegenGuardPlugin()] : [])
        ]
      : [
          electronRendererConfigPresetPlugin({ root: this.options.root }),
          electronRendererConfigValidatorPlugin(),
          ...(config.build?.isolatedEntries ? [isolateEntriesPlugin(this)] : []),
          ...(this.options.typegen ? [typegenGuardPlugin()] : [])
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
  const configDrivenPlugins: PluginOption[] = []

  const externalOptions = config.build?.externalizeDeps ?? true
  if (externalOptions) {
    if (isOptions<ExternalOptions>(externalOptions)) {
      configDrivenPlugins.push(externalizeDepsPlugin(externalOptions))
    } else {
      configDrivenPlugins.push(externalizeDepsPlugin())
    }
  }

  const bytecodeOptions = config.build?.bytecode
  if (bytecodeOptions) {
    if (isOptions<BytecodeOptions>(bytecodeOptions)) {
      configDrivenPlugins.push(bytecodePlugin(bytecodeOptions))
    } else {
      configDrivenPlugins.push(bytecodePlugin())
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
      config: { veldora: { main: {}, preload: {}, renderer: {} } },
      dependencies: []
    }
  }

  try {
    const loaded = await viteLoadConfigFromFile(configEnv, resolvedPath, configRoot, logLevel)
    const config = (loaded?.config ?? {}) as unknown as UserConfig

    if (!ignoreConfigWarning) {
      const missingFields = ['main', 'renderer', 'preload'].filter(
        (field) => !config.veldora?.[field]
      )
      if (missingFields.length > 0) {
        createLogger(logLevel).warn(
          `${colors.yellow(colors.bold('(!)'))} ${colors.yellow(`${missingFields.join(' and ')} config is missing`)}\n`
        )
      }
    }

    return {
      path: normalizePath(loaded?.path ?? resolvedPath),
      config,
      dependencies: loaded?.dependencies ?? []
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
