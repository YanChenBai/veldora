<p align="center">
  <img src="./assets/brand/veldora-hero.png" alt="Veldora" width="420" />
</p>

<h1 align="center">Veldora</h1>

<p align="center">
  <strong>Build Delightful Desktop Apps</strong><br />
  Next-generation Electron build tooling based on Vite+.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veldorajs">
    <img src="https://img.shields.io/npm/v/veldorajs?color=5b8def&label=npm" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/veldorajs">
    <img src="https://img.shields.io/npm/dm/veldorajs?color=5b8def" alt="npm downloads" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/YanChenBai/veldora?color=5b8def" alt="license" />
  </a>
  <img src="https://img.shields.io/badge/Node-%5E20.19%20%7C%7C%20%3E%3D22.12-5b8def" alt="Node.js version" />
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

---

## What is Veldora?

Veldora is a modern Electron build tool rebuilt around [Vite+](https://viteplus.dev).

It keeps the familiar development model of `electron-vite`, while moving the underlying toolchain to a newer Vite+ stack powered by Rolldown and Oxc.

Electron `main`, `preload`, and `renderer` targets live under one `veldora` namespace and can be configured from either:

- `veldora.config.*`
- `vite.config.*`

When both are present, `veldora.config.*` takes precedence.

## Highlights

|                                  |                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------ |
| ⚡ **Vite+ native**              | Rolldown + Oxc based workflow.                                                 |
| 🧩 **Unified Electron config**   | Configure `main`, `preload`, and `renderer` together.                          |
| 🧭 **Shared resolution**         | Reuse aliases and `resolve.tsconfigPaths` across Electron targets.             |
| 🔒 **V8 bytecode**               | Compile main/preload output to V8 bytecode.                                    |
| 🧵 **Node helpers**              | Inject scripts, typed assets, workers, module paths, WASM, and native modules. |
| 🖥 **Developer-friendly runtime** | Coordinated restarts, terminal-forwarded renderer errors, and Vite shortcuts.  |

## Quick Start

### 1. Requirements

Veldora currently expects:

- Node.js `^20.19.0 || >=22.12.0`
- Vite `^8.0.0`
- Electron

A Vite+ workspace is recommended.

If your project is not on Vite+ yet:

```sh
vp migrate
```

### 2. Install

```sh
npm i -D veldorajs electron
```

or:

```sh
pnpm add -D veldorajs electron
```

### 3. Add scripts

```json
{
  "scripts": {
    "dev": "vld dev",
    "build": "vld build",
    "preview": "vld preview"
  }
}
```

`veldora` is the full CLI name. `vld` is the short alias.

### 4. Add Veldora Node types

For TypeScript projects, add `veldorajs/node` to the TypeScript config used by Electron main/preload code:

```jsonc
// tsconfig.node.json
{
  "compilerOptions": {
    "types": ["node", "veldorajs/node"]
  },
  "include": ["vite.config.*", "veldora.config.*", "src/main/**/*", "src/preload/**/*"]
}
```

Or use a declaration file:

```ts
/// <reference types="veldorajs/node" />
```

`veldorajs/node` is a **type-only entry**. Do not import it at runtime.

It provides ambient types for:

- `veldora` on Vite `UserConfig`
- `process.env.ELECTRON_RENDERER_URL`
- `?inject`
- `?nodeWorker`
- `?modulePath`
- `?asset`
- `?asset&asarUnpack`
- native `.node` imports
- `.wasm?loader`

> If you already use `compilerOptions.types`, remember that it acts as an allow-list.

### 5. Configure Electron

#### Option A — `veldora.config.ts`

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  veldora: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

#### Option B — unified `vite.config.ts`

```ts
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  veldora: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

Shared `resolve` options apply to all Electron targets. Target-specific options take precedence.

### 6. Start developing

```sh
npm run dev
```

Build:

```sh
npm run build
```

Preview:

```sh
npm run preview
```

## Configuration

### Shared aliases and tsconfig paths

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': './src'
    }
  },

  veldora: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

Target-specific options can override shared ones:

```ts
export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  veldora: {
    main: {
      resolve: {
        alias: {
          '@main': './src/main'
        }
      }
    },

    preload: {},
    renderer: {}
  }
})
```

### V8 bytecode

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  veldora: {
    main: {
      build: {
        bytecode: true
      }
    },

    preload: {
      build: {
        bytecode: true
      }
    },

    renderer: {}
  }
})
```

### TypeScript decorators

Vite 8 uses Oxc for TypeScript transformation, so Veldora does not need a separate decorator plugin. Configure legacy TypeScript decorators in the tsconfig used by Electron main/preload code:

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Vite forwards these options to Oxc. `emitDecoratorMetadata` is an isolated transform and may not exactly match `tsc` when metadata depends on complex type inference.

### Renderer console forwarding

Renderer errors and `console.warn` / `console.error` are forwarded to the terminal by default.

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  veldora: {
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

### Filtering main process output

The Electron main process often prints noisy, non-actionable messages to the
terminal — for example Chromium's P2P/STUN resolution errors. During
development you can suppress them with `veldora.main.filterConsole`, which
receives each line of stdout/stderr and hides it when the callback returns
`true`.

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  veldora: {
    main: {
      filterConsole: (line) => line.includes('Failed to resolve address')
    }
  }
})
```

## Inject Scripts

Veldora can compile a standalone TypeScript or JavaScript module into an executable JavaScript string with the `?inject` query.

```ts
import script from './get-user.ts?inject'
```

The imported value is a `string`. When evaluated, the generated script invokes the source module's default-exported function and preserves its return value.

For example:

```ts
// get-user.ts
export default async () => {
  const response = await fetch('https://example.com/api/user')
  return response.json()
}
```

It can then be executed with APIs such as Electron's `webContents.executeJavaScript`:

```ts
import getUserScript from './get-user.ts?inject'

const user = await window.webContents.executeJavaScript(getUserScript)
```

`?inject` is available in the Electron `main` target.

Inject modules must be standalone. They may contain local declarations and TypeScript types, but runtime imports, `import.meta`, and named exports are not supported:

```ts
const endpoint = 'https://example.com/api/user'

function normalize(value: unknown) {
  return value
}

export default async () => {
  const response = await fetch(endpoint)
  return normalize(await response.json())
}
```

Veldora transforms the module with Oxc and emits an executable script targeting the Chromium version bundled with the detected Electron release, falling back to ESNext when that version cannot be detected.

## Node-side Import Helpers

After enabling `veldorajs/node`, Veldora-specific imports are type-safe:

```ts
import assetPath from './assets/config.json?asset'
import unpackedAssetPath from './assets/model.bin?asset&asarUnpack'
import workerModulePath from './worker?modulePath'
import createWorker from './worker?nodeWorker'
import nativeAddon from './native/addon.node'
import loadWasm from './codec.wasm?loader'
import injectedScript from './script.ts?inject'
```

Example:

```ts
const worker = createWorker({
  workerData: {
    cwd: process.cwd()
  }
})

const wasm = await loadWasm()
```

## CLI

```sh
vld dev [root]
vld build [root]
vld preview [root]
```

| Option                         | Scope         | Description                                   |
| ------------------------------ | ------------- | --------------------------------------------- |
| `-c, --config <file>`          | all           | Use a specific config file.                   |
| `-m, --mode <mode>`            | all           | Set the environment mode.                     |
| `--outDir <dir>`               | all           | Override the output directory.                |
| `--sourcemap`                  | all           | Emit source maps.                             |
| `--entry <file>`               | all           | Override the Electron entry file.             |
| `-w, --watch`                  | dev           | Rebuild main/preload on file changes.         |
| `--inspect [port]`             | dev           | Enable the V8 inspector.                      |
| `--inspectBrk [port]`          | dev           | Enable the V8 inspector and break on startup. |
| `--remoteDebuggingPort <port>` | dev           | Enable Chromium remote debugging.             |
| `--rendererOnly`               | dev           | Start only the renderer dev server.           |
| `--noSandbox`                  | dev / preview | Disable the Chromium sandbox.                 |
| `--skipBuild`                  | preview       | Preview existing output without rebuilding.   |

During development, press `h` + Enter to show Vite's interactive shortcuts.

- `r` restarts the Vite server and Electron app
- `q` shuts both down

## Programmatic API

```ts
import { build, createServer, loadEnv, mergeConfig, preview } from 'veldorajs'
```

## Migration from electron-vite

### 1. Replace the dependency

```sh
npm rm electron-vite
npm i -D veldorajs
```

### 2. Rename the CLI

```diff
- "dev": "electron-vite dev"
+ "dev": "vld dev"
```

### 3. Move the config

Rename:

```txt
electron.vite.config.*
```

to:

```txt
veldora.config.*
```

or move the Electron config into `vite.config.*`.

### 4. Group targets under `veldora`

```diff
-import { defineConfig, swcPlugin } from 'electron-vite'
+import { defineConfig } from 'veldorajs'

 export default defineConfig({
-  main: { plugins: [swcPlugin()] },
-  preload: {},
-  renderer: {}
+  veldora: {
+    main: {},
+    preload: {},
+    renderer: {}
+  }
 })
```

If you used `swcPlugin` only for legacy decorators or decorator metadata, remove it. Keep `experimentalDecorators` and `emitDecoratorMetadata` in your TypeScript config; Vite 8/Oxc handles those options directly.

### 5. Update ambient types

```diff
- "types": ["node", "electron-vite/node"]
+ "types": ["node", "veldorajs/node"]
```

### 6. Migrate to Vite+

```sh
vp migrate
```

## Contributing

Contributions are welcome.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## License

[MIT](./LICENSE) © byc
