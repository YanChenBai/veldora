// Refresh src/electronVersions.json from the official Electron release feed.
// Invoked by .github/workflows/update-electron-versions.yml on a schedule, and
// runnable locally with `node scripts/updateElectronVersions.mjs`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = 'https://releases.electronjs.org/releases.json'
const output = fileURLToPath(new URL('../src/electronVersions.json', import.meta.url))
const outputName = path.basename(output)

// With --check, report staleness via exit code instead of writing the file.
const checkOnly = process.argv.includes('--check')

// Stable releases only, e.g. "41.10.7" (skips nightlies/betas like "42.0.0-beta.1").
const stableVersion = /^\d+\.\d+\.\d+$/
// Electron <= 10 predates the Vite targets we emit, so the runtime ignores them.
const minimumMajor = 11

const response = await fetch(source)
if (!response.ok) {
  throw new Error(`Failed to fetch ${source}: ${response.status} ${response.statusText}`)
}
const releases = await response.json()

/** @param {number[]} a @param {number[]} b */
const compare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Keep the highest stable release of every Electron major.
/** @type {Map<number, { parts: number[], entry: { electron: string, node: string, chrome: string } }>} */
const latest = new Map()
for (const release of releases) {
  if (!stableVersion.test(release.version)) continue
  const [major, minor, patch] = release.version.split('.').map(Number)
  if (major < minimumMajor) continue
  const parts = [minor, patch]
  const current = latest.get(major)
  if (current && compare(parts, current.parts) <= 0) continue
  latest.set(major, {
    parts,
    entry: { electron: release.version, node: release.node, chrome: release.chrome }
  })
}

const versions = {}
for (const major of [...latest.keys()].sort((a, b) => a - b)) {
  versions[major] = latest.get(major).entry
}

const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf-8')).versions : {}
if (JSON.stringify(previous) === JSON.stringify(versions)) {
  console.log(`${outputName} is already up to date (${Object.keys(versions).length} majors)`)
  process.exit(0)
}

const changed = Object.keys(versions).filter(
  (major) => previous[major]?.electron !== versions[major].electron
)
const removed = Object.keys(previous).filter((major) => !(major in versions))

if (checkOnly) {
  console.error(`${outputName} is out of date; run \`node scripts/updateElectronVersions.mjs\``)
  if (changed.length) console.error(`  changed: ${changed.join(', ')}`)
  if (removed.length) console.error(`  removed: ${removed.join(', ')}`)
  process.exit(1)
}

const data = {
  source,
  updated: new Date().toISOString().slice(0, 10),
  versions
}
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n')

console.log(`Updated ${outputName} (${Object.keys(versions).length} majors)`)
if (changed.length) console.log(`  changed: ${changed.join(', ')}`)
if (removed.length) console.log(`  removed: ${removed.join(', ')}`)
