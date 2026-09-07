import colors from 'picocolors'
import { build as viteBuild, createLogger } from 'vite'
import { type InlineConfig, resolveConfig } from './config'
import { runTypegenOnce } from './typegen/runner'

/**
 * Bundles the electron app for production.
 */
export async function build(inlineConfig: InlineConfig = {}): Promise<void> {
  process.env.NODE_ENV_ELECTRON_VITE = 'production'
  const root = inlineConfig.root || process.cwd()
  const config = await resolveConfig(inlineConfig, 'build', 'production')

  if (!config.config) {
    return
  }

  const logger = createLogger(inlineConfig.logLevel)

  const typegenOptions = config.config.veldora?.typegen
  if (typegenOptions) {
    const count = Object.keys(typegenOptions.entries).length
    const startedAt = Date.now()

    logger.info(colors.cyan(`\nveldora typegen: generating ${count} entries...`))

    try {
      await runTypegenOnce({ root, typegen: typegenOptions })
      logger.info(
        colors.green(`\nveldora typegen: generated ${count} entries in ${Date.now() - startedAt}ms`)
      )
    } catch (error) {
      logger.error(colors.red(`\nveldora typegen failed:\n${(error as Error).message}`))
    }
  }

  // Build targets in order: main -> preload -> renderer
  const buildTargets = ['main', 'preload', 'renderer'] as const

  for (const target of buildTargets) {
    const viteConfig = config.config.veldora?.[target]
    if (viteConfig) {
      // Disable watch mode in production builds
      if (viteConfig.build?.watch) {
        viteConfig.build.watch = null
      }
      await viteBuild(viteConfig)
    }
  }
}
