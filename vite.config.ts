import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: 'esm',
    dts: true,
    outDir: 'dist'
  },
  staged: {
    '*.{js,ts,tsx}': 'vp check --fix'
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    endOfLine: 'lf',
    insertFinalNewline: true,
    singleQuote: true,
    semi: false,
    trailingComma: 'none'
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
