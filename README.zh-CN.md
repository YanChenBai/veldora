<p>
  <h1 align="center">Veldora</h1>
</p>

<p align="center">基于 Vite+ 的下一代 Electron 构建工具</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veldorajs"><img src="https://img.shields.io/npm/v/veldorajs?color=6988e6&label=version" alt="npm version"></a>
  <a href="https://github.com/YanChenBai/veldora/blob/main/LICENSE"><img src="https://img.shields.io/github/license/YanChenBai/veldora?color=blue" alt="license"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<br />

## 为什么 Fork

Veldora 是基于 [electron-vite](https://github.com/alex8088/electron-vite) 重构、运行在 [Vite+](https://viteplus.dev) 之上的 fork。electron-vite 面向的是基于 esbuild 与 Rollup 的 Vite；而 Vite+ 将整个工具链统一到 Rolldown 和 Oxc 上，带来更快的构建，以及一个贯穿整个工作流的 `vite.config.ts`。Veldora 把这些能力带到了 Electron，同时保持 electron-vite 的 API 不变，让你易于上手。

## 改动

- ⚡️ 基于 Vite+（Rolldown + Oxc）重建，取代 esbuild + Rollup
- 📄 Electron 目标从统一的 `vite.config.ts` 加载，同时也支持 `veldora.config.*`
- 🧭 共享的 `resolve` 选项——包括 `tsconfigPaths`——应用到 main、preload 和 renderer
- 🗂 目标分组到 `electron` 配置命名空间下
- 🦀 `swcPlugin` 替换为 `oxcPlugin`（Vite 内置的 Oxc 转换器）
- ⌨️ Vite 交互式开发快捷键，配合协调的 Electron 重启与关闭
- 🖥 浏览器错误和 `console.warn` / `console.error` 默认转发到终端

## 特性

- ⚡️ 基于 [Vite+](https://viteplus.dev)，使用方式与 Vite 一致
- 🛠 为 Electron 的 main、preload 和 renderer 预配置合理的默认值
- 💡 针对 Electron 主进程优化的资源处理
- 🚀 快速 HMR 与热重载
- 🔥 多入口应用的隔离构建
- ✨ 简化的多线程开发
- 🔒 将代码编译为 V8 字节码以保护源码
- 🔌 在 VSCode 和 WebStorm 中轻松调试
- 📦 开箱即用地支持 TypeScript、Vue、React、Svelte、SolidJS 等

## 安装

```sh
npm i -D veldorajs
```

## 使用

将命令添加到你的 `package.json`，然后通过 `npx vld` 运行：

```json
{
  "scripts": {
    "dev": "vld dev",
    "build": "vld build",
    "preview": "vld preview"
  }
}
```

`veldora` 是完整命令名；`vld` 是短别名。

## 配置

`veldora` 会从项目根目录解析 `veldora.config.*` 或 `vite.config.*`，当两者同时存在时，`veldora.config.*` 优先。

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

共享的 `resolve` 选项会应用到 main、preload 和 renderer 三个目标；单个目标声明的选项优先级更高。

### 开发快捷键

renderer 开发服务器启用了 Vite 的交互式 CLI 快捷键。按 `h + enter` 列出所有快捷键。按 `r` 重启 Vite 服务器和 Electron 应用；按 `q` 关闭两者。

### 转发控制台输出

浏览器错误和 `console.warn` / `console.error` 会通过 Vite 的 `server.forwardConsole` 默认转发到终端。你可以在 renderer 配置中禁用或自定义：

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

## 从 electron-vite 迁移

Veldora 保持 electron-vite 的 API，但需要 Vite 8（Vite+）。

1. **更换依赖**

   ```sh
   npm rm electron-vite
   npm i -D veldorajs
   ```

2. **重命名命令**：在 scripts 中把 `electron-vite` 改为 `veldora`（或 `vld`）。

3. **重命名配置文件**：把 `electron.vite.config.*` 改为 `veldora.config.*`（或移入 `vite.config.ts`）。

4. **将目标分组到 `electron` 下**，并将 SWC 插件切换为 Oxc：

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

5. **升级到 Vite 8**。使用 Vite+ 时，将 `vite` 别名为 `@voidzero-dev/vite-plus-core`，并将 `vitest` 锁定为 Vite+ 捆绑的版本。

## 快速开始

```sh
mkdir my-electron-app && cd my-electron-app
npm init -y
npm i -D veldorajs electron
```

按上文添加 scripts 和 `veldora.config.ts`，然后运行 `veldora dev`。

## 贡献

参见 [贡献指南](CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE) © byc
