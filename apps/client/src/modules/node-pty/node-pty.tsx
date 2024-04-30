import { useTerminal } from './service/useTerminal'
import 'xterm/css/xterm.css'
import { usePty } from 'terminal'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'

export function NodePty() {
  const [searchParams] = useSearchParams()

  // 设置是否使用二进制
  const useBinary = searchParams.has('binary')
  const shell = searchParams.get('shell') ?? 'bash'

  const [url, setUrl] = useState(`ws://127.0.0.1:3001/node-pty?shell=${shell ?? 'sh'}&useBinary=${useBinary}`)

  const { terminalEl, init, connect, dispose } = usePty()

  React.useEffect(() => {
    if (url) {
      const id = uuid()
      init()
      connect(`${url}&id=${id}`)
      return () => dispose()
    }
  }, [url])

  return <div ref={terminalEl} className='w-screen h-screen bg-black'></div>
}
