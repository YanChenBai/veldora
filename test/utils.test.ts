import { describe, expect, it } from 'vite-plus/test'
import {
  asyncFlatten,
  cleanUrl,
  deepClone,
  getHash,
  isFilePathESM,
  isObject,
  resolveHostname,
  toRelativePath
} from '../src/utils'

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('returns false for non-plain values', () => {
    expect(isObject(null)).toBe(false)
    expect(isObject([])).toBe(false)
    expect(isObject('str')).toBe(false)
    expect(isObject(1)).toBe(false)
    expect(isObject(new Date())).toBe(false)
  })
})

describe('resolveHostname', () => {
  it('returns the hostname when it is a valid string', () => {
    expect(resolveHostname('127.0.0.1')).toBe('127.0.0.1')
  })

  it('falls back to localhost for wildcard hosts and non-strings', () => {
    expect(resolveHostname('0.0.0.0')).toBe('localhost')
    expect(resolveHostname('::')).toBe('localhost')
    expect(resolveHostname(true)).toBe('localhost')
    expect(resolveHostname(undefined)).toBe('localhost')
  })
})

describe('cleanUrl', () => {
  it('strips query and hash', () => {
    expect(cleanUrl('/foo/bar?a=1#b')).toBe('/foo/bar')
    expect(cleanUrl('/foo/bar')).toBe('/foo/bar')
  })
})

describe('getHash', () => {
  it('returns an 8-char sha256 prefix', () => {
    expect(getHash('hello')).toHaveLength(8)
    expect(getHash('hello')).toBe(getHash('hello'))
  })
})

describe('toRelativePath', () => {
  it('prefixes sibling paths with ./', () => {
    expect(toRelativePath('/a/b/c.ts', '/a/b/index.ts')).toBe('./c.ts')
  })

  it('keeps parent paths as-is', () => {
    expect(toRelativePath('/a/c.ts', '/a/b/index.ts')).toBe('../c.ts')
  })
})

describe('deepClone', () => {
  it('clones nested structures without sharing references', () => {
    const src = { a: { b: [1, 2, 3] }, c: 'str' }
    const clone = deepClone(src)
    expect(clone).toEqual(src)
    expect(clone.a).not.toBe(src.a)
    expect(clone.a.b).not.toBe(src.a.b)
  })

  it('clones regexes', () => {
    const src = { r: /abc/g }
    const clone = deepClone(src)
    expect(clone.r).toEqual(src.r)
    expect(clone.r).not.toBe(src.r)
  })

  it('keeps functions by reference', () => {
    const fn = (): number => 1
    const clone = deepClone({ fn })
    expect(clone.fn).toBe(fn)
  })
})

describe('isFilePathESM', () => {
  it('detects ESM by extension', () => {
    expect(isFilePathESM('/a/b.mjs')).toBe(true)
    expect(isFilePathESM('/a/b.mts')).toBe(true)
    expect(isFilePathESM('/a/b.ts')).toBe(true)
    expect(isFilePathESM('/a/b.cjs')).toBe(false)
    expect(isFilePathESM('/a/b.cts')).toBe(false)
  })
})

describe('asyncFlatten', () => {
  it('flattens nested promises and arrays', async () => {
    const result = await asyncFlatten([Promise.resolve([1, 2]), [3, Promise.resolve(4)]])
    expect(result).toEqual([1, 2, 3, 4])
  })
})
