import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { WebTerminal } from 'core'
import { processMessageToServer, K8sWebsocketProtocol, processMessageFromServer } from './config'

const url = 'wss://xxx/exec'
const token = 'NAz0nAI34X1UpS5lILOKbK1fO2I_3Qh7UVKq2-kt_3o.650omNloyCWKfLWrlZFDGtsVLLi02evhjlxqLQgDfX8'
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const terminal = useCreation(() => {
    return new WebTerminal({})
  }, [])

  // terminal 初始化
  // useEffect(() => {
  //   if (terminalEl.current) {
  //     terminal.init(terminalEl.current)
  //     return () => {
  //       terminal.destroy()
  //     }
  //   }
  // }, [])

  useEffect(() => {
    if (url) {
      const xterm = terminal.init(terminalEl.current)
      terminal.fitWindowResize()

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?token=${token}&columns=${cols}&lines=${rows}`

      const socket = terminal.connectSocket(urlWithQuery, [K8sWebsocketProtocol], {
        processMessageToServer,
        processMessageFromServer,
      })

      // 添加心跳
      let timer: number | undefined
      socket.addEventListener('open', () => {
        terminal.focus()
        timer = window.setInterval(function () {
          socket?.sendMessage('heartbeat')
        }, 30 * 1000)
      })

      socket.addEventListener('error', () => {
        terminal.write('Connect Error.')
      })

      socket.addEventListener('close', (e) => {
        const { code, reason } = e
        console.error('close', code, reason)
        terminal.write('disconnect.')
        if (timer) clearInterval(timer)
      })

      return () => {
        if (timer) clearInterval(timer)
        terminal.destroy()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
