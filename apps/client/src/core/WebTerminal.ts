import { ITerminalOptions, Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { CanvasAddon } from 'xterm-addon-canvas'
import { WebglAddon } from 'xterm-addon-webgl'
import { AttachAddon, AttachAddonOptions } from './AttachAddon'
import { detectWebGLContext } from './utils'

/**
 * 1. new temrinal
 * 2. open element
 * 3. attach socket
 *    3.1 new websocket
 *    3.2 socket onopen -> focus / socket send auth message
 *    3.3 terminal ondata -> socket send
 *    3.4 socket onmessage -> terminal write / heartbeat / nothing
 *    3.5 socket onerror onclose -> dispose
 *    3.6 terminal onResize -> socket send resize message
 *    3.7 interval -> socket send heartbeat message
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
        console.error('something error: lost webgl context')
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

    this.open(element)
    this.fitWindowResize()
  }

  public connectSocket(url: string, protocols?: string | string[], options?: AttachAddonOptions) {
    this.socket = new AttachAddon(url, protocols, options)
    this.loadAddon(this.socket)

    return this.socket
  }

  public fit = () => {
    try {
      this.fitAddon.fit()
    } catch (e) {
      console.error('fit error', e)
    }
  }

  private resizeCb = () => {
    this.fit()
  }

  public fitWindowResize() {
    this.fit()
    window.addEventListener('resize', this.resizeCb)
  }

  public destroySocket(manualClose = false) {
    if (this.socket) {
      if (manualClose) this.socket.close(1000, 'frontend close')
      this.socket.dispose()
      this.socket = undefined
    }
  }

  public destroy() {
    this.destroySocket(true)
    window.removeEventListener('resize', this.resizeCb)
    this.dispose()
  }
}

// const connectSocket = () => {
//   const otherOptions = {
//     protocol: 'channel.k8s.io',
//     command: 'sh',
//     stdin: true,
//     stdout: true,
//     stderr: true,
//     tty: true,
//   }
//   const query = qs.stringify({
//     // ...podInfo,
//     ...otherOptions,
//   })
//   return new WebSocket(`ws://${location.host}?${query}`, ['TOKEN'])
// }
