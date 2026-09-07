<p align="center">
  <img src="./assets/brand/veldora-hero.png" alt="Veldora" width="420" />
</p>

<h1 align="center">Veldora</h1>

<p align="center">
  <strong>Build Delightful Desktop Apps</strong><br />
  基于 Vite+ 的新一代 Electron 开发与构建工具。
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

## Veldora 是什么？

Veldora 是一个围绕 [Vite+](https://viteplus.dev) 重构的现代 Electron 构建工具。

它保留了 `electron-vite` 熟悉的开发模式，同时把底层工具链迁移到由 Rolldown 和 Oxc 驱动的新一代 Vite+ 生态。

Electron 的 `main`、`preload`、`renderer` 三个目标统一放在 `electron` 配置命名空间下，并且可以从下面两种配置文件中读取：

- `veldora.config.*`
- `vite.config.*`

如果两者同时存在，`veldora.config.*` 优先。

## 核心特性

|                           |                                                                   |
| ------------------------- | ----------------------------------------------------------------- |
| ⚡ **原生面向 Vite+**     | 基于 Rolldown + Oxc 的构建流程。                                  |
| 🧩 **统一 Electron 配置** | `main`、`preload`、`renderer` 放在同一个 `electron` 命名空间。    |
| 🧭 **共享解析配置**       | alias 与 `resolve.tsconfigPaths` 可以跨 Electron 目标复用。       |
| 🔒 **V8 Bytecode**        | main / preload 输出可编译为 V8 字节码。                           |
| 🧵 **Node 侧辅助能力**    | 内置 assets、workers、module path、WASM、native module 类型支持。 |
| 🖥 **更好的开发体验**      | Electron 协同重启、Renderer 错误转发到终端、Vite 交互快捷键。     |

## 快速开始

### 1. 环境要求

Veldora 当前要求：

- Node.js `^20.19.0 || >=22.12.0`
- Vite `^8.0.0`
- Electron

推荐直接使用 Vite+ 工作区。

如果项目还没有迁移到 Vite+：

```sh
vp migrate
```

### 2. 安装

```sh
npm i -D veldorajs electron
```

或者：

```sh
pnpm add -D veldorajs electron
```

### 3. 添加 scripts

```json
{
  "scripts": {
    "dev": "vld dev",
    "build": "vld build",
    "preview": "vld preview"
  }
}
```

`veldora` 是完整 CLI 名称，`vld` 是短命令。

### 4. 配置 `veldorajs/node`

如果项目使用 TypeScript，请在 Electron main / preload 使用的 tsconfig 中添加 `veldorajs/node`：

```jsonc
// tsconfig.node.json
{
  "compilerOptions": {
    "types": ["node", "veldorajs/node"]
  },
  "include": ["vite.config.*", "veldora.config.*", "src/main/**/*", "src/preload/**/*"]
}
```

也可以通过声明文件引入：

```ts
/// <reference types="veldorajs/node" />
```

`veldorajs/node` 是一个 **仅类型入口**，不要在运行时代码中写：

```ts
import 'veldorajs/node'
```

它提供的 ambient types 包括：

- Vite `UserConfig` 上的 `electron`
- `process.env.ELECTRON_RENDERER_URL`
- `?nodeWorker`
- `?modulePath`
- `?asset`
- `?asset&asarUnpack`
- `.node` 原生模块
- `.wasm?loader`

> 如果已经配置了 `compilerOptions.types`，需要注意它是一个 allow-list，其他需要的类型也必须保留。

### 5. 配置 Electron

#### 方式 A — `veldora.config.ts`

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  electron: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

#### 方式 B — 统一写在 `vite.config.ts`

```ts
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  electron: {
    main: {},
    preload: {},
    renderer: {}
  }
})
```

共享的 `resolve` 会应用到所有 Electron target；target 内部配置优先级更高。

### 6. 启动开发

```sh
npm run dev
```

构建：

```sh
npm run build
```

预览：

```sh
npm run preview
```

## 配置指南

### 共享 alias 与 tsconfig paths

```ts
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

如果某个配置只应该作用于单独 target，可以写在 target 内：

```ts
export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },

  electron: {
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

### V8 Bytecode

```ts
import { defineConfig } from 'veldorajs'

export default defineConfig({
  electron: {
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

### TypeScript 装饰器

Vite 8 已经使用 Oxc 转换 TypeScript，因此 Veldora 不需要额外的装饰器插件。需要 legacy TypeScript decorators 时，直接在 Electron main / preload 使用的 tsconfig 中配置：

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Vite 会把这些选项交给 Oxc。`emitDecoratorMetadata` 属于 isolated transform；当 metadata 依赖复杂类型推断时，结果可能无法与 `tsc` 完全一致。

### Renderer Console 转发

Renderer 中的错误以及 `console.warn` / `console.error` 默认会转发到终端。

```ts
import { defineConfig } from 'veldorajs'

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

## Node 侧 Import Helpers

启用 `veldorajs/node` 后，这些 Veldora 特殊导入都可以获得完整类型：

```ts
import assetPath from './assets/config.json?asset'
import unpackedAssetPath from './assets/model.bin?asset&asarUnpack'
import workerModulePath from './worker?modulePath'
import createWorker from './worker?nodeWorker'
import nativeAddon from './native/addon.node'
import loadWasm from './codec.wasm?loader'
```

示例：

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

| 参数                           | 作用范围      | 说明                               |
| ------------------------------ | ------------- | ---------------------------------- |
| `-c, --config <file>`          | 全部          | 指定配置文件。                     |
| `-m, --mode <mode>`            | 全部          | 设置环境模式。                     |
| `--outDir <dir>`               | 全部          | 覆盖输出目录。                     |
| `--sourcemap`                  | 全部          | 输出 Source Map。                  |
| `--entry <file>`               | 全部          | 覆盖 Electron 入口文件。           |
| `-w, --watch`                  | dev           | 文件变化后重新构建 main/preload。  |
| `--inspect [port]`             | dev           | 开启 V8 Inspector。                |
| `--inspectBrk [port]`          | dev           | 开启 V8 Inspector 并在启动时断点。 |
| `--remoteDebuggingPort <port>` | dev           | 开启 Chromium Remote Debugging。   |
| `--rendererOnly`               | dev           | 只启动 Renderer Dev Server。       |
| `--noSandbox`                  | dev / preview | 禁用 Chromium Sandbox。            |
| `--skipBuild`                  | preview       | 不重新构建，直接预览已有产物。     |

开发过程中输入 `h` + Enter 可以查看 Vite 的交互式快捷键。

- `r`：重启 Vite Server 与 Electron
- `q`：关闭两者

## Node API

Veldora 也可以直接在 Node.js 中使用：

```ts
import { build, createServer, loadEnv, mergeConfig, preview } from 'veldorajs'
```

## 从 electron-vite 迁移

### 1. 替换依赖

```sh
npm rm electron-vite
npm i -D veldorajs
```

### 2. 修改 CLI

```diff
- "dev": "electron-vite dev"
+ "dev": "vld dev"
```

### 3. 修改配置文件

把：

```txt
electron.vite.config.*
```

改成：

```txt
veldora.config.*
```

或者直接把 Electron 配置迁移进 `vite.config.*`。

### 4. 把 targets 放入 `electron`

```diff
-import { defineConfig, swcPlugin } from 'electron-vite'
+import { defineConfig } from 'veldorajs'

 export default defineConfig({
-  main: { plugins: [swcPlugin()] },
-  preload: {},
-  renderer: {}
+  electron: {
+    main: {},
+    preload: {},
+    renderer: {}
+  }
 })
```

如果原来使用 `swcPlugin` 只是为了 legacy decorators 或 decorator metadata，可以直接移除。继续在 TypeScript 配置中保留 `experimentalDecorators` 与 `emitDecoratorMetadata`，Vite 8/Oxc 会直接处理这些选项。

### 5. 更新 ambient types

```diff
- "types": ["node", "electron-vite/node"]
+ "types": ["node", "veldorajs/node"]
```

### 6. 迁移 Vite+

```sh
vp migrate
```

## 贡献

欢迎贡献。

提交 Pull Request 前请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

[MIT](./LICENSE) © byc
