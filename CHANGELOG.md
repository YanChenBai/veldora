# Changelog

## v0.0.5

[compare changes](https://github.com/YanChenBai/veldora/compare/v0.0.4...v0.0.5)

### 🚀 Enhancements

- Add built-in inject script support ([195cb58](https://github.com/YanChenBai/veldora/commit/195cb58))
- **electron:** Source build targets from version data ([#8](https://github.com/YanChenBai/veldora/pull/8))

### 🩹 Fixes

- **inject-script:** Target Electron Chromium and detect exports via AST ([dbd2b4e](https://github.com/YanChenBai/veldora/commit/dbd2b4e))
- **inject-script:** Reject import.meta and keep named default bindings ([a96573b](https://github.com/YanChenBai/veldora/commit/a96573b))
- **inject-script:** Reject non-callable default exports at build time ([b8684d8](https://github.com/YanChenBai/veldora/commit/b8684d8))

### 💅 Refactors

- Rename inject to inject-script and update docs ([1be8dfe](https://github.com/YanChenBai/veldora/commit/1be8dfe))

### 🏡 Chore

- Upgrade CI workflows and update dependencies ([ed836cf](https://github.com/YanChenBai/veldora/commit/ed836cf))
- Add reusable project skills ([4d262b9](https://github.com/YanChenBai/veldora/commit/4d262b9))
- Ignore .ghfs ([71da8a1](https://github.com/YanChenBai/veldora/commit/71da8a1))
- Format README tables ([b69597e](https://github.com/YanChenBai/veldora/commit/b69597e))
- Format skill docs and configs ([84d4967](https://github.com/YanChenBai/veldora/commit/84d4967))

### ❤️ Contributors

- Byc ([@YanChenBai](https://github.com/YanChenBai))

## v0.0.4

[compare changes](https://github.com/YanChenBai/veldora/compare/v0.0.3...v0.0.4)

### 🚀 Enhancements

- **electron:** Add main process console filtering ([cd6b4e8](https://github.com/YanChenBai/veldora/commit/cd6b4e8))

### 🩹 Fixes

- **electron:** Drain filtered output before exit ([f38bf4b](https://github.com/YanChenBai/veldora/commit/f38bf4b))
- **ci:** Use pnpm packing for preview packages ([1176cfd](https://github.com/YanChenBai/veldora/commit/1176cfd))

### 💅 Refactors

- ⚠️  Rename electron config namespace to veldora ([076f6d0](https://github.com/YanChenBai/veldora/commit/076f6d0))

### 🤖 CI

- Add pkg.pr.new preview publishing ([e6e32de](https://github.com/YanChenBai/veldora/commit/e6e32de))

#### ⚠️ Breaking Changes

- ⚠️  Rename electron config namespace to veldora ([076f6d0](https://github.com/YanChenBai/veldora/commit/076f6d0))

### ❤️ Contributors

- Byc ([@YanChenBai](https://github.com/YanChenBai))

## v0.0.3

[compare changes](https://github.com/YanChenBai/veldora/compare/v0.0.2...v0.0.3)

### 🩹 Fixes

- **ci:** Point release notes link to master branch ([8dac112](https://github.com/YanChenBai/veldora/commit/8dac112))

### 💅 Refactors

- ⚠️ Remove `oxcPlugin` wrapper and rely on Vite 8/Oxc decorator configuration ([7581951](https://github.com/YanChenBai/veldora/commit/7581951))

#### ⚠️ Breaking Changes

- `oxcPlugin` is no longer exported; configure decorators through TypeScript/Vite options. ([7581951](https://github.com/YanChenBai/veldora/commit/7581951))

### ❤️ Contributors

- Byc ([@YanChenBai](https://github.com/YanChenBai))
- ChatGPT <noreply@openai.com>

## v0.0.2

[compare changes](https://github.com/YanChenBai/veldora/compare/v0.0.1...v0.0.2)

### 🚀 Enhancements

- **types:** Support vite-plus type augmentation ([2763c6e](https://github.com/YanChenBai/veldora/commit/2763c6e))
- **server:** Restore interactive CLI shortcuts ([397a4b7](https://github.com/YanChenBai/veldora/commit/397a4b7))

### 📖 Documentation

- Refresh README and add brand assets ([aa80606](https://github.com/YanChenBai/veldora/commit/aa80606))

### ❤️ Contributors

- Byc ([@YanChenBai](https://github.com/YanChenBai))

## v0.0.1

[compare changes](https://github.com/YanChenBai/veldora/compare/v6.0.0-beta.1...v0.0.1)

### 🚀 Enhancements

- **config:** Support Vite+ resolve options ([43d0f1f](https://github.com/YanChenBai/veldora/commit/43d0f1f))
- **server:** Enable Vite dev console features ([355dd49](https://github.com/YanChenBai/veldora/commit/355dd49))
- **cli:** Add evp alias and bump version ([70ecce7](https://github.com/YanChenBai/veldora/commit/70ecce7))
- ⚠️  Rebuild on Vite+ and rename to veldorajs ([e130e72](https://github.com/YanChenBai/veldora/commit/e130e72))

### 🔥 Performance

- Setup rollupOption compatibility via config factory ([31965d2](https://github.com/YanChenBai/veldora/commit/31965d2))

### 🩹 Fixes

- Remove useless preset config ([4bede21](https://github.com/YanChenBai/veldora/commit/4bede21))
- **swcPlugin:** Also disable oxc on Vite 8 ([#920](https://github.com/YanChenBai/veldora/pull/920))

### 💅 Refactors

- ⚠️  Remove legacy plugin API and esbuild ([1e5a610](https://github.com/YanChenBai/veldora/commit/1e5a610))

### 📖 Documentation

- Describe Vite+ fork features ([79062bd](https://github.com/YanChenBai/veldora/commit/79062bd))

### 🏡 Chore

- Rename package to @byc/electron-vite-plus and set version to 0.0.1 ([b85bc0e](https://github.com/YanChenBai/veldora/commit/b85bc0e))
- Add changelogen release workflow and remove esbuild build restriction ([6575fc5](https://github.com/YanChenBai/veldora/commit/6575fc5))
- Add pre-release checks to release script ([1cf9143](https://github.com/YanChenBai/veldora/commit/1cf9143))
- Link GitHub release notes to changelog ([1372aca](https://github.com/YanChenBai/veldora/commit/1372aca))

### 🎨 Styles

- Format release workflow ([1f492d9](https://github.com/YanChenBai/veldora/commit/1f492d9))

#### ⚠️ Breaking Changes

- ⚠️  Rebuild on Vite+ and rename to veldorajs ([e130e72](https://github.com/YanChenBai/veldora/commit/e130e72))
- ⚠️  Remove legacy plugin API and esbuild ([1e5a610](https://github.com/YanChenBai/veldora/commit/1e5a610))

### ❤️ Contributors

- Byc ([@YanChenBai](https://github.com/YanChenBai))
- Edenbuilds <omkar1sonawane@gmail.com>
- Alex8088 <244096523@qq.com>

