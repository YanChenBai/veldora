// Refresh src/electronVersions.json from the official Electron release feed.
// Invoked by .github/workflows/update-electron-versions.yml on a schedule, and
// runnable locally with `node scripts/updateElectronVersions.mjs`.
//
// `--feed <path|url>` and `--out <path>` point the run at a fixture instead of
// the checked-in data, which is how the parsing is exercised without network
// access.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = 'https://releases.electronjs.org/releases.json'
const defaultOutput = fileURLToPath(new URL('../src/electronVersions.json', import.meta.url))

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

// With --check, report staleness via exit code instead of writing the file.
const checkOnly = process.argv.includes('--check')
const feed = option('--feed') || source
const output = option('--out') || defaultOutput
const outputName = path.basename(output)

// Stable releases only, e.g. "41.10.7" (skips nightlies/betas like "42.0.0-beta.1").
const stableVersion = /^\d+\.\d+\.\d+$/
// Chromium reports four components, e.g. "87.0.4280.141"; Node and Electron three.
const nodeVersion = /^\d+\.\d+\.\d+$/
const chromeVersion = /^\d+\.\d+\.\d+\.\d+$/
// Electron <= 10 predates the Vite targets we emit, so the runtime ignores them.
const minimumMajor = 11

const loadReleases = async () => {
  if (!/^https?:/.test(feed)) {
    return JSON.parse(fs.readFileSync(feed, 'utf-8'))
  }
  const response = await fetch(feed)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${feed}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Reads a version field the feed is expected to provide.
 *
 * `src/electron.ts` splits these strings at build time, so a missing or
 * malformed field would otherwise be written into `src/` and only surface as a
 * crash in every user build, long after this script reported success.
 *
 * @param {unknown} value
 * @param {RegExp} pattern
 * @param {string} field
 * @param {string} release
 */
const readVersion = (value, pattern, field, release) => {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(
      `Unexpected ${field} version for electron ${release}: ${JSON.stringify(value)}. ` +
        `The ${source} feed may have changed shape.`
    )
  }
  return value
}

/** @param {number[]} a @param {number[]} b */
const compare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const releases = await loadReleases()

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
    entry: {
      electron: release.version,
      node: readVersion(release.node, nodeVersion, 'node', release.version),
      chrome: readVersion(release.chrome, chromeVersion, 'chrome', release.version)
    }
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
