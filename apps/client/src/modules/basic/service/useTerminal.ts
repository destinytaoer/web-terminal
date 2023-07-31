import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'

export function useTerminal() {
  const terminalEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (terminalEl.current) {
      const terminal = new Terminal()
      terminal.open(terminalEl.current)

      terminal.write('service connecting...')

      setTimeout(() => {
        terminal.write('\x1b[1K\r')
        terminal.write('connected!')
      }, 3000)

      terminal.onData((data) => {
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
