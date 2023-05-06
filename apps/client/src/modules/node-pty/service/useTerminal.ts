import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { v4 as uuid } from 'uuid'
import { Logger, WebTerminal } from 'core'
import { generateMessage, processMessageFromServer } from './config'

const log = new Logger('WebTerminal')
const url = 'ws://127.0.0.1:3001/node-pty'
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const terminal = useCreation(() => {
    return new WebTerminal({
      fontSize: 20,
    })
  }, [])

  // terminal 初始化
  useEffect(() => {
    if (terminalEl.current) {
      terminal.init(terminalEl.current)
      return () => {
        terminal.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (url) {
      const id = uuid()
      const cols = terminal.cols
      const rows = terminal.rows
      const urlWithQuery = `${url}?id=${id}&cols=${cols}&rows=${rows}`

      terminal.clear()

      log.info('connect socket', urlWithQuery)
      const socket = terminal.connectSocket(urlWithQuery, [], {
        processMsgSendToServer: generateMessage,
        processMsgFromServer: processMessageFromServer,
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
        terminal.destroySocket(true)
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
