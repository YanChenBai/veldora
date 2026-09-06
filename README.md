<p>
  <h1 align="center">Veldora</h1>
</p>

<p align="center">Next generation Electron build tooling based on Vite+</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veldorajs"><img src="https://img.shields.io/npm/v/veldorajs?color=6988e6&label=version" alt="npm version"></a>
  <a href="https://github.com/YanChenBai/veldora/blob/main/LICENSE"><img src="https://img.shields.io/github/license/YanChenBai/veldora?color=blue" alt="license"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<br />

## Why a Fork

Veldora is a fork of [electron-vite](https://github.com/alex8088/electron-vite) rebuilt on [Vite+](https://viteplus.dev). electron-vite targets Vite with esbuild and Rollup; Vite+ unifies the stack on Rolldown and Oxc for faster builds and one `vite.config.ts` for the entire workflow. Veldora brings that to Electron while keeping the electron-vite API familiar.

## What's Changed

- ⚡️ Rebuilt on Vite+ (Rolldown + Oxc) instead of esbuild + Rollup
- 📄 Electron targets load from a unified `vite.config.ts` as well as `veldora.config.*`
- 🧭 Shared `resolve` options — including `tsconfigPaths` — applied across main, preload and renderer
- 🗂 Targets grouped under an `electron` config namespace
- 🦀 `swcPlugin` replaced with `oxcPlugin` (Vite's built-in Oxc transformer)
- ⌨️ Vite interactive dev shortcuts with coordinated Electron restart and shutdown
- 🖥 Browser errors and `console.warn` / `console.error` forwarded to the terminal by default

## Features

- ⚡️ Powered by [Vite+](https://viteplus.dev) and used the same way as Vite
- 🛠 Sensible defaults pre-configured for Electron main, preload and renderer
- 💡 Optimized asset handling for the Electron main process
- 🚀 Fast HMR and hot reloading
- 🔥 Isolated builds for multi-entry applications
- ✨ Simplified multi-threading development
- 🔒 Compile code to V8 bytecode to protect source code
- 🔌 Easy to debug in VSCode and WebStorm
- 📦 TypeScript, Vue, React, Svelte, SolidJS and more out of the box

## Installation

```sh
npm i -D veldorajs
```

## Usage

Add the commands to your `package.json` and run them with `npx vld`:

```json
{
  "scripts": {
    "dev": "vld dev",
    "build": "vld build",
    "preview": "vld preview"
  }
}
```

`veldora` is the full command name; `vld` is the short alias.

## Configuration

`veldora` resolves `veldora.config.*` or `vite.config.*` from the project root, with `veldora.config.*` taking precedence when both exist.

```ts
// veldora.config.ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': './src'
    }
  },
  electron: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

Shared `resolve` options apply to all three targets; per-target options take precedence.

### Dev shortcuts

The renderer server exposes Vite's interactive CLI shortcuts. Press `h + enter` to list them. `r` restarts the Vite server and the Electron app; `q` closes both.

### Forwarding console

Browser errors and `console.warn` / `console.error` are forwarded to the terminal through Vite's `server.forwardConsole`. Disable or customize it in the renderer config:

```ts
export default defineConfig({
  electron: {
    renderer: {
      server: {
        forwardConsole: {
          unhandledErrors: true,
          logLevels: ['warn', 'error']
        }
      }
    }
  }
})
```

## Migration from electron-vite

Veldora keeps the electron-vite API but requires Vite 8 (Vite+).

1. **Swap the dependency**

   ```sh
   npm rm electron-vite
   npm i -D veldorajs
   ```

2. **Rename the command** in your scripts: `electron-vite` → `veldora` (or `vld`).

3. **Rename the config file**: `electron.vite.config.*` → `veldora.config.*` (or move into `vite.config.ts`).

4. **Group targets under `electron`** and switch the SWC plugin to Oxc:

   ```diff
   -import { defineConfig, swcPlugin } from 'electron-vite'
   +import { defineConfig, oxcPlugin } from 'veldorajs'

    export default defineConfig({
   -  main: { plugins: [swcPlugin()] },
   -  preload: {},
   -  renderer: {}
   +  electron: {
   +    main: { plugins: [oxcPlugin()] },
   +    preload: {},
   +    renderer: {}
   +  }
    })
   ```

5. **Upgrade to Vite 8**. With Vite+, alias `vite` to `@voidzero-dev/vite-plus-core` and pin `vitest` to the version bundled by Vite+.

## Getting Started

```sh
mkdir my-electron-app && cd my-electron-app
npm init -y
npm i -D veldorajs electron
```

Add the scripts and a `veldora.config.ts` as shown above, then run `veldora dev`.

## Contribution

See [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](./LICENSE) © byc
