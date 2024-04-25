import * as React from 'react'
import { useCreation } from 'ahooks'
import { TerminalCore } from '../../core'
import { Protocol, spliceUrl } from './config'
import { ExecAttachAddon } from './ExecAttachAddon.ts'
import { addSocketListener, Disposable, log } from '../../utils'

export const useExecTerminal = (url?: string) => {
  const terminalEl = React.useRef<HTMLDivElement>(null)
  const clear = React.useRef<Function>()

  const terminal = useCreation(() => {
    return new TerminalCore()
  }, [])

  React.useEffect(() => {
    if (terminalEl.current) {
      const xterm = terminal.init(terminalEl.current)
      terminal.fitDomResize()

      if (url) connect(url)

      return () => {
        terminal.dispose()
        clear.current?.()
      }
    }
  }, [url])

  function attach(socket: WebSocket) {
    const attachAddon = new ExecAttachAddon(socket)
    terminal.loadAddon(attachAddon)

    const disposable = new Disposable()

    // 添加事件
    const onopen = () => {
      log.success('connect socket success')
      terminal.focus()
      setTimeout(() => {
        attachAddon?.sendMessage('resize', {
          cols: terminal.xterm?.cols,
          rows: terminal.xterm?.rows,
        })
      }, 2000)
    }
    const onerror = (e: Event) => {
      log.info('write connect error.')
      terminal.write('Connect Error.')
    }
    const onclose = (e: CloseEvent) => {
      log.info('write disconnect.', e.code, e.reason)
      terminal.write('disconnect.')
      disposable.dispose()
    }

    // 使用 register 注册的事件会在 terminal.destroy/dispose 中被移除
    disposable.register(addSocketListener(socket, 'open', onopen))
    disposable.register(addSocketListener(socket, 'error', onerror))
    disposable.register(addSocketListener(socket, 'close', onclose))

    return () => {
      attachAddon.dispose()
      disposable.dispose()
      terminal.reset()
      clear.current = undefined
    }
  }

  function connect(url: string) {
    if (clear.current) {
      clear.current()
    }
    // const addons = terminal.xterm?._addonManager?._addons
    // for (const addon of addons) {
    //   if (addon.instance instanceof ExecAttachAddon) {
    //     console.log('terminal already attach one socket, so close the old socket.')
    //     addon.instance.dispose()
    //   }
    // }
    if (!terminal.xterm) {
      log.error('Please connect after init terminal')
      return
    }
    const newUrl = spliceUrl(url, terminal.xterm)

    const socket = new WebSocket(newUrl, [Protocol])

    return (clear.current = attach(socket))
  }

  return {
    terminalEl,
    connect,
  }
}
