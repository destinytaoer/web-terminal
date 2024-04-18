import { useTerminal } from './service/useTerminal'
import { Button, Input } from 'antd'
import * as React from 'react'

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
  return (
    <div className='w-screen h-screen'>
      <div className='h-10 items-center flex gap-2'>
        <Input placeholder='请输入关键字搜索' value={keyword} onChange={onKeywordChange} />
        <Button onClick={onSearch}>查找</Button>
        <Button onClick={onFindNextSearch}>查找下一个</Button>
        <Button onClick={onFindPreviousSearch}>查找上一个</Button>
        <Button onClick={onExitSearch}>退出查找</Button>
      </div>
      <div ref={terminalEl}></div>
    </div>
  )
}
