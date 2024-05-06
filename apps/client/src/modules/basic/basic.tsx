import { useTerminal } from './service/useTerminal'
import { Button, Input } from 'antd'
import * as React from 'react'
import { useEffect } from 'react'

interface IBasicProps {}

export function Basic(props: IBasicProps) {
  const {} = props
  const { terminalEl, terminal } = useTerminal()
  const [keyword, setKeyword] = React.useState('')
  const onKeywordChange = (e) => {
    setKeyword(e.target.value)
  }
  const onSearch = () => {
    onFindNextSearch()
  }
  const onFindNextSearch = () => {
    terminal.findNext(keyword)
  }
  const onFindPreviousSearch = () => {
    terminal.findPrevious(keyword)
  }
  const onExitSearch = () => {
    terminal.exitSearch()
  }

  const [theme, setTheme] = React.useState(false)
  const onThemeChange = () => {
    setTheme((theme) => !theme)
  }

  useEffect(() => {
    if (theme) {
      // light
      terminal.changeTheme({
        foreground: '#657b83',
        background: '#fdf6e3',
        cursor: '#657b83',
        cursorAccent: '#eee8d5',
        selectionBackground: '#eee8d5',
        // selectionForeground: '#586e75',
        selectionInactiveBackground: '#eee8d5',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#002b36',
        brightRed: '#cb4b16',
        brightGreen: '#586e75',
        brightYellow: '#657b83',
        brightBlue: '#839496',
        brightMagenta: '#6c71c4',
        brightCyan: '#93a1a1',
        brightWhite: '#fdf6e3',
      })
    } else {
      // dark default
      terminal.changeTheme({
        foreground: '#ffffff',
        background: '#000000',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        // selectionForeground: '#000000',
        selectionInactiveBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#2e3436',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec',
      })
    }
    // console.log('refresh', 0, terminal.xterm?.rows - 1)
    // terminal.xterm?.refresh(0, terminal.xterm?.rows - 1)
    // terminal.xterm.clearTextureAtlas()
  }, [theme])

  return (
    <div className='w-screen h-screen'>
      <div className='h-10 items-center flex gap-2'>
        <Input placeholder='请输入关键字搜索' value={keyword} onChange={onKeywordChange} />
        <Button onClick={onSearch}>查找</Button>
        <Button onClick={onFindNextSearch}>查找下一个</Button>
        <Button onClick={onFindPreviousSearch}>查找上一个</Button>
        <Button onClick={onExitSearch}>退出查找</Button>
        <Button onClick={onThemeChange}>切换主题</Button>
      </div>
      <div ref={terminalEl}></div>
    </div>
  )
}
