// Run after `vp pack`: node scripts/smoke-bytecode.mjs <electron-executable> <major>
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { build } from '../dist/index.mjs'

const [electron, major] = process.argv.slice(2)
assert(electron && /^\d+$/.test(major), 'Pass an Electron executable and its major version')
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'veldora-bytecode-smoke-'))
const preload = path.join(root, 'out/preload/index.cjs')
const main = path.join(root, 'out/main/index.cjs')
process.env.ELECTRON_EXEC_PATH = path.resolve(electron)
process.env.ELECTRON_MAJOR_VER = major

try {
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'commonjs', main }))
  await fs.writeFile(
    path.join(root, 'main.js'),
    `
    import { app, BrowserWindow, ipcMain } from 'electron'
    let win
    app.whenReady().then(() => {
      console.log('main-ok', process.versions.node)
      ipcMain.on('smoke-bytecode', (_event, value) => {
        console.log(value)
        app.quit()
      })
      win = new BrowserWindow({ show: false, webPreferences: {
        preload: ${JSON.stringify(preload)}, sandbox: false, contextIsolation: true
      } })
      win.webContents.on('preload-error', (_event, _file, error) => {
        console.error(error)
        app.exit(1)
      })
      win.loadURL('data:text/html,<!doctype html><html></html>')
    })
  `
  )
  await fs.writeFile(
    path.join(root, 'preload.js'),
    `
    import { ipcRenderer } from 'electron'
    ipcRenderer.send('smoke-bytecode', 'preload-ok')
  `
  )
  const target = (name) => ({
    root,
    build: {
      outDir: path.join(root, 'out', name),
      lib: { entry: path.join(root, `${name}.js`), formats: ['cjs'] },
      rolldownOptions: { output: { entryFileNames: 'index.cjs' } },
      bytecode: { protectedStrings: ['main-ok', 'preload-ok'] }
    }
  })
  const configFile = path.join(root, 'veldora.config.mjs')
  await fs.writeFile(
    configFile,
    `export default ${JSON.stringify({
      veldora: {
        main: target('main'),
        preload: target('preload')
      }
    })}`
  )
  await build({ root, configFile, logLevel: 'warn', ignoreConfigWarning: true })
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const { stdout } = await promisify(execFile)(electron, [main], {
    cwd: root,
    env,
    windowsHide: true,
    timeout: 30_000
  })
  assert.match(stdout, /main-ok/)
  assert.match(stdout, /preload-ok/)
  console.log(stdout.trim())
  console.log('Electron main and preload bytecode smoke passed')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
