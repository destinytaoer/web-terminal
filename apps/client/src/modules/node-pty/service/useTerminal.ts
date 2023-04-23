import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { v4 as uuid } from 'uuid'
import { WebTerminal } from 'core'
import { generateMessage, processMessageFromServer } from './config'

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
    }
    return () => {
      terminal.destroy()
    }
  }, [])

  useEffect(() => {
    if (url) {
      const id = uuid()
      const cols = terminal.cols
      const rows = terminal.rows
      const urlWithQuery = `${url}?id=${id}&cols=${cols}&rows=${rows}`

      terminal.clear()

      const socket = terminal.connectSocket(urlWithQuery, [], {
        sendMessageMapper: generateMessage,
        onmessageMapper: processMessageFromServer,
      })

      let timer: number | undefined
      socket.addListener('open', () => {
        // 在下一个事件循环中执行, 相当于 nextTick
        // Promise.resolve().then(() => {
        //   const { rows, cols } = terminal
        //   socket?.sendMessage('resize', { cols, rows })
        // })

        terminal.focus()

        timer = window.setInterval(function () {
          socket?.sendMessage('heartbeat')
        }, 30 * 1000)
      })

      socket.addListener('error', () => {
        terminal.write('Connect Error.')
      })

      socket.addListener('close', () => {
        // const { code, reason, wasClean } = e
        terminal.write('disconnect.')
        if (timer) clearInterval(timer)
        terminal.destroySocket(false)
      })

      const resizeListener = terminal.onResize(({ cols, rows }) => {
        socket?.sendMessage('resize', { cols, rows })
      })

      return () => {
        if (timer) clearInterval(timer)
        resizeListener.dispose()
        terminal.destroySocket(true)
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
