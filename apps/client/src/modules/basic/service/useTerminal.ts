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
      const xterm = terminal.init(terminalEl.current)
      terminal.changeSearchOptions({
        decorations: {
          matchBackground: '#EFBE28', // 匹配项的背景色
          matchBorder: '#8FBEFF', // 匹配项的边框色
          matchOverviewRuler: '#BBF494', // 匹配项在 OverviewRuler 中显示的颜色
          activeMatchBackground: '#FF0000', // 当前匹配项的背景色
          activeMatchBorder: '#1677FF', // 当前匹配项的边框色
          activeMatchColorOverviewRuler: '#0000FF', // 当前匹配项在 OverviewRuler 中显示的颜色
        },
      })
      // terminal.fitWindowResize()
      terminal.fitDomResize()
      xterm.onResize((...args) => {
        console.log('args', args)
      })
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')
      terminal.write('service connecting...\r\n')

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
    terminal,
  }
}
