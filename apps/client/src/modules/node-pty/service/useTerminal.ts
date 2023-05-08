import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { v4 as uuid } from 'uuid'
import { Logger, WebTerminal } from 'core'
import { processMessageToServer, processMessageFromServer } from './config'

const log = new Logger('WebTerminal', 'dev')
const url = 'ws://127.0.0.1:3001/node-pty'
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const terminal = useCreation(() => {
    return new WebTerminal()
  }, [])

  // terminal 初始化
  // useEffect(() => {
  //   if (terminalEl.current) {
  //     log.info('init terminal')
  //     terminal.init(terminalEl.current)
  //     return () => {
  //       log.info('destroy terminal')
  //       terminal.destroy()
  //     }
  //   }
  // }, [])

  useEffect(() => {
    if (url) {
      const id = uuid()
      log.info('init terminal')
      const xterm = terminal.init(terminalEl.current)

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?id=${id}&cols=${cols}&rows=${rows}`

      log.info('connect socket', urlWithQuery)
      const socket = terminal.connectSocket(urlWithQuery, [], {
        processMessageToServer,
        processMessageFromServer,
      })

      // 添加心跳
      let timer: number | undefined
      socket.addEventListener('open', () => {
        log.success('socket open')
        timer = window.setInterval(function () {
          socket?.sendMessage('heartbeat')
        }, 30 * 1000)
      })

      socket.addEventListener('error', () => {
        terminal.write('Connect Error.')
      })

      socket.addEventListener('close', () => {
        // const { code, reason, wasClean } = e
        terminal.write('disconnect.')
        if (timer) clearInterval(timer)
      })

      return () => {
        if (timer) clearInterval(timer)
        log.info('destroy terminal')
        terminal.destroy()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
