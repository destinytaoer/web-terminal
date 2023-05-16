import { debounce } from 'lodash'
import { ITerminalAddon, ITerminalOptions, Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { CanvasAddon } from 'xterm-addon-canvas'
import { WebglAddon } from 'xterm-addon-webgl'
import { AttachAddon, AttachAddonOptions } from './AttachAddon'
import { detectWebGLContext, log } from './utils'

export interface WebTerminalOptions {
  rendererType?: 'dom' | 'canvas' | 'webgl'
  xtermOptions?: ITerminalOptions
}

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
export class WebTerminal {
  private fitAddon = new FitAddon()

  private webglAddon?: WebglAddon

  private canvasAddon?: CanvasAddon

  xterm?: Terminal

  socket?: AttachAddon

  options: WebTerminalOptions

  constructor(options: WebTerminalOptions = {}) {
    this.options = {
      rendererType: 'webgl',
      ...options,
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

    this.xterm = new Terminal({
      cursorBlink: true,
      ...this.options.xtermOptions,
    })

    // load addon
    this.xterm.loadAddon(this.fitAddon)
    this.xterm.loadAddon(new WebLinksAddon())

    // 初始化渲染器
    this.initRenderer()
    // 渲染
    this.xterm.open(element)
    this.fit()

    // 实现 fit resize 能力
    // 放置到业务中自行添加
    // this.fitWindowResize()

    return this.xterm
  }

  private initRenderer() {
    const { rendererType } = this.options

    const disposeCanvasRenderer = () => {
      try {
        this.canvasAddon?.dispose()
      } catch {
        // ignore
      }
      this.canvasAddon = undefined
    }
    const disposeWebglRenderer = () => {
      try {
        this.webglAddon?.dispose()
      } catch {
        // ignore
      }
      this.webglAddon = undefined
    }
    const enableCanvasRenderer = () => {
      if (this.canvasAddon) return
      this.canvasAddon = new CanvasAddon()
      disposeWebglRenderer()
      try {
        this.loadAddon(this.canvasAddon)
        log.info('render xterm use canvas')
      } catch (e) {
        log.warn('canvas renderer could not be loaded, falling back to dom renderer', e)
        disposeCanvasRenderer()
      }
    }
    const enableWebglRenderer = () => {
      if (this.webglAddon) return
      disposeCanvasRenderer()
      try {
        // https://github.com/xtermjs/xterm.js/issues/3357
        // safari < 16 报错 已调整到 WebglAddon 的 constructor 中
        if (detectWebGLContext()) {
          this.webglAddon = new WebglAddon()
          this.webglAddon.onContextLoss((e) => {
            log.error('something error: lost webgl context', e)
            this.webglAddon?.dispose()
          })
          this.loadAddon(this.webglAddon)
          log.info('render xterm use webgl')
        } else {
          throw new Error('not support webgl')
        }
      } catch (e) {
        log.warn('WebGL renderer could not be loaded, falling back to canvas renderer', e)
        disposeWebglRenderer()
        enableCanvasRenderer()
      }
    }

    switch (rendererType) {
      case 'canvas':
        enableCanvasRenderer()
        break
      case 'webgl':
        enableWebglRenderer()
        break
      case 'dom':
        disposeWebglRenderer()
        disposeCanvasRenderer()
        log.info('render xterm use dom')
        break
      default:
        break
    }
  }

  fit = () => {
    try {
      this.fitAddon.fit()
    } catch (e) {
      log.error('fit error', e)
    }
  }

  // 添加 window resize 事件
  fitWindowResize() {
    window.addEventListener('resize', this.resizeCb)
  }

  // 是否支持 resize
  private resizeFlag = true

  suspendResize() {
    this.resizeFlag = false
  }

  resumeResize() {
    this.resizeFlag = true
  }

  private resizeCb = debounce(() => {
    if (this.resizeFlag) {
      this.fit()
    }
  }, 500)

  loadAddon(addon: ITerminalAddon) {
    this.xterm?.loadAddon(addon)
  }

  write(data: string | Uint8Array) {
    this.xterm?.write(data)
  }

  focus() {
    this.xterm?.focus()
  }

  connectSocket(url: string, protocols?: string | string[], options?: AttachAddonOptions) {
    const attachAddon = new AttachAddon(url, protocols, options)

    // loadAddon 的时候调用 addon 的 activate, 传入 terminal
    this.loadAddon(attachAddon)

    return (this.socket = attachAddon)
  }

  destroy() {
    // 前端手动关闭
    if (this.socket) {
      this.socket.close(1000, 'frontend close')
      this.socket.dispose()
      this.socket = undefined
    }
    window.removeEventListener('resize', this.resizeCb)
    this.xterm?.dispose()
  }
}
