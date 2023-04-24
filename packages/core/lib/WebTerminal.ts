import { ITerminalOptions, Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { CanvasAddon } from 'xterm-addon-canvas'
import { WebglAddon } from 'xterm-addon-webgl'
import { AttachAddon, AttachAddonOptions } from './AttachAddon'
import { detectWebGLContext } from './utils'
import { debounce } from 'lodash'

/**
 * ● init terminal
 *   ○ new Terminal
 *   ○ terminal.open(element)
 *   ○ load fitAddon -> fit window resize listener
 *   ○ load weblinkAddon
 *   ○ load renderer -> dom/canvas/webgl
 * ● connect websocket
 *   ○ new Websocket -> with auth info & terminal size info
 *   ○ socket onopen -> terminal.focus / send auth message & terminal size message
 *   ○ socket onerror -> terminal.write('connect error') / error handler
 *   ○ socket onclose -> terminal.write('disconnect')/ dispose / show close code and reason
 *   ○ socket onmessage -> terminal.write -> 返回消息处理
 *   ○ terminal ondata -> socket send input message -> 输入消息处理
 *   ○ terminal onresize -> socket send resize message
 *   ○ deal time -> socket send heartbeat message
 * ● dispose terminal
 *   ○ socket.close
 *   ○ terminal.dispose
 *   ○ window remove resize listener
 */
export class WebTerminal extends Terminal {
  public fitAddon: FitAddon

  public socket?: AttachAddon

  constructor(options?: ITerminalOptions) {
    super({
      cursorBlink: true,
      // fontFamily: "'Courier New', 'Courier', monospace",
      // fontSize: 12,
      // lineHeight: 1,
      // theme: {
      //   foreground: '#f0f0f0',
      // },
      ...options,
    })

    // fitAddon
    const fitAddon = new FitAddon()
    this.fitAddon = fitAddon
    this.loadAddon(fitAddon)

    // web link addon
    this.loadAddon(new WebLinksAddon())

    // renderer
    if (detectWebGLContext()) {
      console.log('render xterm use webgl')
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss((e) => {
        console.error('something error: lost webgl context', e)
        webglAddon.dispose()
      })
      this.loadAddon(webglAddon)
    } else {
      console.log('render xterm use canvas')
      this.loadAddon(new CanvasAddon())
    }
  }

  init(element: string | HTMLElement) {
    if (!element) {
      throw new Error(`should give element parameter`)
    }
    if (typeof element === 'string') {
      const id = element
      const el = document.getElementById(id)
      if (!el) throw new Error(`Can't find element by id: ${id}`)
      element = el
    }

    // 初始化
    this.open(element)
    // 实现 fit resize 能力
    this.fitWindowResize()
  }

  public fitWindowResize() {
    this.fit()
    window.addEventListener('resize', this.resizeCb)
  }

  public connectSocket(url: string, protocols?: string | string[], options?: AttachAddonOptions) {
    const socket = new AttachAddon(url, protocols, options)

    // loadAddon 的时候调用 addon 的 activate, 传入 terminal
    this.loadAddon(socket)

    this.socket = socket

    return socket
  }

  private resizeCb = debounce(() => {
    this.fit()
  }, 500)

  public fit = () => {
    try {
      this.fitAddon.fit()
    } catch (e) {
      console.error('fit error', e)
    }
  }

  public destroySocket(manualClose = false) {
    if (this.socket) {
      // 前端手动关闭
      if (manualClose) this.socket.close(1000, 'frontend close')
      this.socket.dispose()
      this.socket = undefined
    }
  }

  public destroy() {
    // 前端手动关闭
    if (this.socket) {
      this.socket.close(1000, 'frontend close')
      this.socket.dispose()
      this.socket = undefined
    }
    window.removeEventListener('resize', this.resizeCb)
    this.dispose()
  }
}
