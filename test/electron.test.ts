import { describe, expect, it } from 'vite-plus/test'
import { filterConsoleOutput } from '../src/electron'

describe('filterConsoleOutput', () => {
  it('forwards lines that do not match the filter', () => {
    const result = filterConsoleOutput('hello\nworld\n', '', () => false)
    expect(result.buffer).toBe('')
    expect(result.output).toBe('hello\nworld\n')
  })

  it('suppresses lines that match the filter', () => {
    const filter = (line: string): boolean => line.includes('stun.chat.bilibili.com')
    const line =
      '[41952:0907/191159.416:ERROR:services/network/p2p/socket_manager.cc:145] Failed to resolve address for stun.chat.bilibili.com., errorcode: -105'
    const result = filterConsoleOutput(`${line}\nok\n`, '', filter)
    expect(result.output).toBe('ok\n')
  })

  it('accumulates partial lines across chunks', () => {
    const filter = (line: string): boolean => line.includes('error')
    const first = filterConsoleOutput('some ', '', filter)
    const second = filterConsoleOutput('error line\nnext\n', first.buffer, filter)
    expect(second.output).toBe('next\n')
    expect(second.buffer).toBe('')
  })

  it('normalizes CRLF line endings', () => {
    const filter = (line: string): boolean => line.includes('drop')
    const result = filterConsoleOutput('keep\r\ndrop me\r\n', '', filter)
    expect(result.output).toBe('keep\n')
  })
})
