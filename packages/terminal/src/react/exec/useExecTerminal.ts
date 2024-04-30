import * as React from 'react'
import { useCreation } from 'ahooks'
import { TerminalCore } from '../../core'
import { Protocol, spliceUrl } from './config'
import { ExecAttachAddon } from './ExecAttachAddon'
import { addSocketListener, Disposable, log, toDisposable } from '../../utils'

export const useExecTerminal = (url?: string) => {
  const terminalEl = React.useRef<HTMLDivElement>(null)
  const clear = React.useRef<Function>()

  const terminal = useCreation(() => {
    return new TerminalCore()
  }, [])

  const init = React.useCallback(() => {
    if (terminalEl.current) {
      const xterm = terminal.init(terminalEl.current)
      terminal.fitDomResize()
    }
  }, [terminal])

  const attach = React.useCallback(
    (socket: WebSocket) => {
      const attachAddon = new ExecAttachAddon(socket)
      terminal.loadAddon(attachAddon)
      terminal.attachAddon = attachAddon

      const disposable = new Disposable()

      // 添加事件
      const onopen = () => {
        log.success('connect socket success')
        terminal.focus()
        const timer = setTimeout(() => {
          attachAddon?.sendMessage('resize', {
            cols: terminal.xterm?.cols,
            rows: terminal.xterm?.rows,
          })
        }, 2000)
        disposable.register(
          toDisposable(() => {
            if (timer) clearTimeout(timer)
          }),
        )
      }
      const onerror = (e: Event) => {
        log.info('write connect error.')
        terminal.write('Connect Error.')
      }
      const onclose = (e: CloseEvent) => {
        terminal.write('disconnect.')
        disposable.dispose()
      }

      disposable.register(addSocketListener(socket, 'open', onopen))
      disposable.register(addSocketListener(socket, 'error', onerror))
      disposable.register(addSocketListener(socket, 'close', onclose))

      // attachAddon.on('stdout', () => {
      //   refreshUserLastActionTime()
      // })

      attachAddon.on('error', (data) => {
        const error = data.error
        const exitCode = error?.exitCode
        const message = error?.message
        log.error('receive error from server', error)
      })

      return () => {
        attachAddon.dispose()
        disposable.dispose()
        terminal.reset()
        clear.current = undefined
      }
    },
    [terminal],
  )

  const connect = React.useCallback(
    (url: string) => {
      clear.current?.()
      if (!terminal.xterm) {
        log.error('Please connect after init terminal')
        return
      }
      const newUrl = spliceUrl(url, terminal.xterm)

      const socket = new WebSocket(newUrl, [Protocol])

      return (clear.current = attach(socket))
    },
    [terminal, attach],
  )

  const dispose = React.useCallback(() => {
    terminal.dispose()
    clear.current?.()
  }, [terminal])

  return {
    terminalEl,
    init,
    connect,
    dispose,
  }
}
