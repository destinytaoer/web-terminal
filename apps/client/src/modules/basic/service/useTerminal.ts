import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { TerminalCore } from 'terminal'
import { useCreation } from 'ahooks'

export function useTerminal() {
  const terminalEl = useRef<HTMLDivElement>(null)

  const terminal = useCreation(() => {
    return new TerminalCore()
  }, [])

  useEffect(() => {
    if (terminalEl.current) {
      terminal.init(terminalEl.current)
      // const terminal = new Terminal()
      // terminal.open(terminalEl.current)
      terminal.fitWindowResize()

      terminal.write('service connecting...')

      setTimeout(() => {
        terminal.write('\x1b[1K\r')
        terminal.write('connected!')
      }, 3000)

      terminal.xterm.onData((data) => {
        terminal.write(data)
      })

      return () => {
        terminal.dispose()
      }
    }
  }, [])

  return {
    terminalEl,
  }
}
