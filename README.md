<p align="center">
  <img src="https://alex8088.github.io/assets/electron-vite.svg" width="150px" height="150px">
</p>

<div align="center">
  <h1>electron-vite</h1>
</div>
<p align="center">Next generation Electron build tooling based on Vite</p>

<p align="center">
<img src="https://img.shields.io/npm/v/electron-vite?color=6988e6&label=version">
<img src="https://img.shields.io/github/license/alex8088/electron-vite?color=blue" alt="license" />
</p>

<p align="center">
<a href="https://electron-vite.org">Documentation</a> |
<a href="https://electron-vite.org/guide">Getting Started</a> |
<a href="https://github.com/alex8088/quick-start/tree/master/packages/create-electron">create-electron</a>
</p>

<p align="center">
<a href="https://cn.electron-vite.org">中文文档</a>
</p>

<br />
<br />

## About This Fork

This repository is a fork of [alex8088/electron-vite](https://github.com/alex8088/electron-vite) focused on Vite+ integration while staying close to upstream.

Additions in this fork:

- Load Electron targets from a unified Vite+ `vite.config.ts`.
- Share Vite+ resolve options, including `tsconfigPaths`, across main, preload and renderer.
- Provide Vite's interactive development shortcuts with coordinated Electron restart and shutdown.
- Forward browser errors and warning/error console output to the development terminal by default.

## Features

- ⚡️ [Vite](https://vitejs.dev) powered and use the same way.
- 🛠 Pre-configure with sensible defaults optimized for Electron.
- 💡 Optimize asset handling for Electron main process.
- 🚀 Fast HMR & hot reloading.
- 🔥 Isolated build for multi-entry application development.
- ✨ Simplify multi-threading development.
- 🔒 Compile code to v8 bytecode to protect source code.
- 🔌 Easy to debug in IDEs such as VSCode or WebStorm.
- 📦 Out-of-the-box support for TypeScript, Vue, React, Svelte, SolidJS and more.

## Usage

### Install

```sh
npm i electron-vite -D
```

### Development & Build

In a project where `electron-vite` is installed, you can use `electron-vite` binary directly with `npx electron-vite` or add the npm scripts to your `package.json` file like this:

```json
{
  "scripts": {
    "start": "electron-vite preview",
    "dev": "electron-vite dev",
    "prebuild": "electron-vite build"
  }
}
```

### Configuration

When running `electron-vite` from the command line, electron-vite will automatically try to resolve `electron.vite.config.*` or `vite.config.*` inside the project root. When both exist, `electron.vite.config.*` takes precedence.

Vite+ projects can keep the Electron targets and shared resolve options in a single `vite.config.ts`. The shared `resolve` options are applied to main, preload and renderer; options declared by an individual target take precedence.

```ts
// vite.config.ts
import { defineConfig } from 'electron-vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': './src'
    }
  },
  main: {},
  preload: {},
  renderer: {}
})
```

During development, the renderer server enables Vite's interactive CLI shortcuts. Press `h + enter` to list them. Restarting with `r` restarts both the Vite server and the Electron app, while `q` closes both processes.

Browser runtime errors and `console.warn` / `console.error` calls are forwarded to the terminal by default through Vite's `server.forwardConsole`. You can disable or customize it in the renderer config:

```ts
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error']
      }
    }
  }
})
```

### Getting Started

Clone the [electron-vite-boilerplate](https://github.com/alex8088/electron-vite-boilerplate) or use the [create-electron](https://github.com/alex8088/quick-start/tree/master/packages/create-electron) tool to scaffold your project.

```bash
npm create @quick-start/electron@latest
```

Currently supported template presets include:

|                                                 JavaScript                                                 |                                                    TypeScript                                                    |
| :--------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------: |
| [vanilla](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/vanilla) | [vanilla-ts](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/vanilla-ts) |
|     [vue](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/vue)     |     [vue-ts](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/vue-ts)     |
|   [react](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/react)   |   [react-ts](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/react-ts)   |
|  [svelte](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/svelte)  |  [svelte-ts](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/svelte-ts)  |
|   [solid](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/solid)   |   [solid-ts](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/solid-ts)   |

## Contribution

See [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](./LICENSE) © alex.wei
