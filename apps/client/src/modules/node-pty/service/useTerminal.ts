import { useEffect, useRef, useState } from 'react'
import { useCreation } from 'ahooks'
import { v4 as uuid } from 'uuid'
// import { addSocketListener, log } from 'terminal'
// import { processMessageToServer, processMessageFromServer, uploadFile, createHeartbeat } from './config'
import { useSearchParams } from 'react-router-dom'

const url = 'ws://127.0.0.1:3001/node-pty'

export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()

  // 设置是否使用二进制
  const useBinary = searchParams.has('binary')
  const shell = searchParams.get('shell') ?? 'bash'

  // const terminal = useCreation(() => {
  //   console.log('new WebTerminal')
  //   return new WebTerminal()
  // }, [])
  //
  // useEffect(() => {
  //   return () => {
  //     log.info('dispose terminal')
  //     terminal.dispose()
  //   }
  // }, [])

  const [url, setUrl] = useState(`ws://127.0.0.1:3001/node-pty?shell=${shell ?? 'sh'}&useBinary=${useBinary}`)

  useEffect(() => {
    if (url && terminalEl.current) {
      const id = uuid()
      // log.info('init terminal')
      // const terminal = new WebTerminal()
      // const xterm = terminal.init(terminalEl.current)
      // terminal.fitWindowResize()
      //
      // log.info('useBinary:', useBinary)
      // log.info('shell:', shell)
      //
      // const cols = xterm.cols
      // const rows = xterm.rows
      // const urlWithQuery = `${url}&id=${id}&cols=${cols}&rows=${rows}`
      //
      // log.info('connect socket', urlWithQuery)
      // const socket = terminal.connectSocket({
      //   url: urlWithQuery,
      //   heartbeatTime: 15 * 1000,
      //   processMessageToServer,
      //   processMessageFromServer,
      // })
      //
      // terminal.register(
      //   addSocketListener(socket, 'open', () => {
      //     log.success('socket open')
      //     terminal.focus()
      //   }),
      // )
      // terminal.register(
      //   addSocketListener(socket, 'error', (e: Event) => {
      //     log.error('socket error', e)
      //     terminal.write('Connect Error.')
      //   }),
      // )
      //
      // terminal.register(
      //   addSocketListener(socket, 'close', (e: CloseEvent) => {
      //     const { code, reason } = e
      //     log.error('socket close', code, reason, new Date().toLocaleString())
      //     terminal.write('disconnect.')
      //   }),
      // )
      //
      // terminal.on('service:stdout', (content) => {
      //   log.info('stdout', content)
      // })
      //
      // return () => {
      //   log.info('clear terminal')
      //   terminal.dispose()
      // }
    }
  }, [url])

  return {
    terminalEl,
  }
}
