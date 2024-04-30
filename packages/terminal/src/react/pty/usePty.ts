import * as React from 'react'
import { useCreation } from 'ahooks'
import { TerminalCore } from '../../core'
import { PtyAttachAddon } from './PtyAttachAddon'
import { addSocketListener, Disposable, log, toDisposable } from '../../utils'
import { spliceUrl } from './config'

export const usePty = () => {
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
      const attachAddon = new PtyAttachAddon(socket)
      terminal.loadAddon(attachAddon)
      terminal.attachAddon = attachAddon

      const disposable = new Disposable()

      // 添加事件
      const onopen = () => {
        log.success('connect socket success')
        terminal.focus()
        // const timer = setTimeout(() => {
        //   attachAddon?.sendMessage('resize', {
        //     cols: terminal.xterm?.cols,
        //     rows: terminal.xterm?.rows,
        //   })
        // }, 2000)
        // disposable.register(
        //   toDisposable(() => {
        //     if (timer) clearTimeout(timer)
        //   }),
        // )
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

      attachAddon.on('stdout', (content) => {
        log.info('stdout', content)
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

      const socket = new WebSocket(newUrl, [])

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
    terminal,
    init,
    connect,
    dispose,
  }
}
