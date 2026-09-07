import { build as viteBuild } from 'vite'
import { type InlineConfig, resolveConfig } from './config'
import { generateTypes } from './typegen'

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

  const typegenOptions = config.config.veldora?.typegen
  if (typegenOptions) {
    await generateTypes(typegenOptions, root)
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
