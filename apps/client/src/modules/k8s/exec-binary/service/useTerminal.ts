import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { WebTerminal } from 'core'
import { processMessageToServer, k8s, processMessageFromServer } from './config'

const url = 'wss://xxx/exec'
const token = 'NAz0nAI34X1UpS5lILOKbK1fO2I_3Qh7UVKq2-kt_3o.650omNloyCWKfLWrlZFDGtsVLLi02evhjlxqLQgDfX8'
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const terminal = useCreation(() => {
    return new WebTerminal({})
  }, [])

  useEffect(() => {
    if (url) {
      const xterm = terminal.init(terminalEl.current)
      terminal.fitWindowResize()

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?token=${token}&columns=${cols}&lines=${rows}`

      const socket = terminal.connectSocket(urlWithQuery, [k8s.protocol.binary], {
        processMessageToServer,
        processMessageFromServer,
      })

      // 添加心跳
      let timer: number | undefined
      const onopen = () => {
        terminal.focus()
        timer = window.setInterval(function () {
          socket?.sendMessage('heartbeat')
        }, 30 * 1000)
      }
      const onerror = () => {
        terminal.write('Connect Error.')
      }
      const onclose = (e) => {
        const { code, reason } = e
        console.error('close', code, reason)
        terminal.write('disconnect.')
        if (timer) clearInterval(timer)
      }

      socket.addEventListener('open', onopen)

      socket.addEventListener('error', onerror)

      socket.addEventListener('close', onclose)

      return () => {
        if (timer) clearInterval(timer)
        socket.removeEventListener('open', onopen)

        socket.removeEventListener('error', onerror)

        socket.removeEventListener('close', onclose)
        terminal.destroy()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
