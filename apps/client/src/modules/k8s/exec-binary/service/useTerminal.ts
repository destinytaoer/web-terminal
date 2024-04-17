import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { log, WebTerminal } from 'terminal'
import { processMessageToServer, k8s, processMessageFromServer } from './config'

const url = ''
const token = ''
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  // const terminal = useCreation(() => {
  //   return new WebTerminal()
  // }, [])

  useEffect(() => {
    if (url && terminalEl.current) {
      const terminal = new WebTerminal()
      const xterm = terminal.init(terminalEl.current)
      terminal.fitWindowResize()

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?token=${token}&columns=${cols}&lines=${rows}`

      const socket = terminal.connectSocket({
        url: urlWithQuery,
        protocols: [k8s.protocol.binary],
        heartbeatTime: 15 * 1000,
        processMessageToServer,
        processMessageFromServer,
      })

      const onopen = () => {
        terminal.focus()
      }
      const onerror = () => {
        terminal.write('Connect Error.')
      }
      const onclose = (e) => {
        const { code, reason } = e
        console.error('close', code, reason)
        terminal.write('disconnect.')
      }

      terminal.on('service:stdout', (content) => {
        log.info('stdout', content)
      })

      socket.addEventListener('open', onopen)

      socket.addEventListener('error', onerror)

      socket.addEventListener('close', onclose)

      return () => {
        socket.removeEventListener('open', onopen)

        socket.removeEventListener('error', onerror)

        socket.removeEventListener('close', onclose)
        terminal.dispose()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
