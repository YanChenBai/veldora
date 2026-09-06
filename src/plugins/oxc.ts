import type { OxcOptions as ViteOxcOptions, Plugin, UserConfig } from 'vite'

export type OxcOptions = {
  /**
   * Options forwarded to Vite's built-in Oxc transformer.
   * `decorator` defaults to `{ legacy: true, emitDecoratorMetadata: true }`.
   */
  transformOptions?: ViteOxcOptions
}

/**
 * Enable Vite's built-in Oxc transformer to emit type metadata for legacy decorators.
 */
export function oxcPlugin(options: OxcOptions = {}): Plugin {
  return {
    name: 'vite:oxc',
    config(): UserConfig {
      return {
        oxc: {
          decorator: { legacy: true, emitDecoratorMetadata: true },
          ...options.transformOptions
        }
      }
    }
  }
}
