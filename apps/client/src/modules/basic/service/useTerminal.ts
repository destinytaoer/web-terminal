import { useEffect, useRef } from 'react'
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
        // terminal.write('\x1b[1K\r')
        // 清空当前行
        // terminal.write(TerminalController.eraseInLine('LINE'))
        // 回到行首
        // terminal.write(TerminalController.CR)
        // 打印
        terminal.write('connected!')
        // 修改标题
        // terminal.write(TerminalController.changeTitle('change title'))
      }, 3000)

      terminal.xterm.onData((data) => {
        terminal.write(data)
      })
      terminal.xterm.onTitleChange((title) => {
        console.log('title: ', title)
        document.title = title
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
