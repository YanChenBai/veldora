import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Plugin } from 'vite'
import { MainConfigFactory } from '../src/config'
import { cloneConfig } from '../src/utils'

afterEach(() => vi.unstubAllEnvs())

describe('configuration isolation', () => {
  it('clones config data while preserving plugins, promises and opaque runtime instances', () => {
    const runtime = new Map([['value', 1]])
    const plugin: Plugin = { name: 'stateful', api: { runtime } }
    const pending = Promise.resolve(plugin)
    const config = {
      plugins: [[plugin], pending],
      resolve: { alias: { source: '/source' } },
      runtime
    }
    const copy = cloneConfig(config)
    expect(copy).not.toBe(config)
    expect(copy.plugins).not.toBe(config.plugins)
    expect(copy.plugins[0]).not.toBe(config.plugins[0])
    expect(copy.plugins[0][0]).toBe(plugin)
    expect(copy.plugins[1]).toBe(pending)
    expect(copy.runtime).toBe(runtime)
    copy.resolve.alias.source = '/changed'
    expect(config.resolve.alias.source).toBe('/source')
  })

  it('supports circular data and preserves regexp matching state', () => {
    const pattern = /chunk/g
    pattern.lastIndex = 3
    const config: { pattern: RegExp; self?: unknown } = { pattern }
    config.self = config
    const copy = cloneConfig(config)
    expect(copy.self).toBe(copy)
    expect(copy.pattern).not.toBe(pattern)
    expect(copy.pattern.lastIndex).toBe(3)
  })

  it('preserves user plugin identity and does not duplicate config-driven plugins', async () => {
    vi.stubEnv('ELECTRON_MAJOR_VER', '30')
    vi.stubEnv('NODE_ENV_ELECTRON_VITE', 'production')
    const external: Plugin = { name: 'vite:externalize-deps' }
    const bytecode: Plugin = { name: 'vite:bytecode' }
    const factory = new MainConfigFactory(
      {
        plugins: [Promise.resolve([external, bytecode])],
        build: { bytecode: true }
      },
      {},
      {}
    )
    const config = await factory.build()
    const plugins = (await Promise.all(config.plugins!)).flat(Infinity).filter(Boolean) as Plugin[]
    expect(plugins.filter((plugin) => plugin.name === external.name)).toEqual([external])
    expect(plugins.filter((plugin) => plugin.name === bytecode.name)).toEqual([bytecode])
    expect(plugins.find((plugin) => plugin.name === external.name)).toBe(external)
    expect(plugins.find((plugin) => plugin.name === bytecode.name)).toBe(bytecode)
  })
})
