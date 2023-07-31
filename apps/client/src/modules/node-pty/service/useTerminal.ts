import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { v4 as uuid } from 'uuid'
import { addSocketListener, log, WebTerminal } from 'core'
import { processMessageToServer, processMessageFromServer, uploadFile, createHeartbeat } from './config'
import { useSearchParams } from 'react-router-dom'
import Logger from 'log'

const url = 'ws://127.0.0.1:3001/node-pty'
Logger.enable('*')
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()

  // 设置是否使用二进制
  const useBinary = searchParams.has('binary')
  const shell = searchParams.get('shell') ?? 'bash'

  const terminal = useCreation(() => {
    return new WebTerminal()
  }, [])

  useEffect(() => {
    if (url && terminalEl.current) {
      const id = uuid()
      log.info('init terminal')
      const xterm = terminal.init(terminalEl.current)
      terminal.fitWindowResize()

      log.info('useBinary:', useBinary)
      log.info('shell:', shell)

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?id=${id}&cols=${cols}&rows=${rows}&shell=${shell ?? 'sh'}&useBinary=${useBinary}`

      log.info('connect socket', urlWithQuery)
      const socket = terminal.connectSocket(urlWithQuery, [], {
        processMessageToServer,
        processMessageFromServer,
        enableZmodem: true,
        enableTrzsz: true,
        onSend() {
          log.success('onSend')
          uploadFile()
            .then((files) => {
              const file = files.item(0)
              // if (!file || file.size > 200 * 1024 * 1024) {
              //   log.error('over limit')
              //   throw 'over limit'
              // }
              log.success('prepare to upload files', files)
              terminal.sendFiles(files)
            })
            .catch(() => {
              log.warn('cancel upload files')
              terminal.cancelUploadFile()
            })
        },
      })

      // 添加心跳
      const heartbeat = createHeartbeat(() => {
        log.info('send heartbeat', new Date().toLocaleString())
        socket?.sendMessage('heartbeat')
      })

      terminal.register(
        addSocketListener(socket, 'open', () => {
          log.success('socket open')
          terminal.focus()
          heartbeat.start()
        }),
      )
      terminal.register(
        addSocketListener(socket, 'error', () => {
          terminal.write('Connect Error.')
        }),
      )

      terminal.register(
        addSocketListener(socket, 'close', () => {
          terminal.write('disconnect.')
          heartbeat.stop()
        }),
      )

      return () => {
        heartbeat.stop()
        log.info('destroy terminal')
        terminal.destroy()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
