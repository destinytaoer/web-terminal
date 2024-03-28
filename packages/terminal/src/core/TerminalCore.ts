import { ITerminalAddon, ITerminalInitOnlyOptions, ITerminalOptions, Terminal } from '@xterm/xterm'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { addDisposableEventListener, Disposable, detectWebGLContext, log } from '../utils'
import { debounce } from 'lodash'

export interface EnhancedTerminalOptions {
  rendererType?: 'dom' | 'canvas' | 'webgl'
  webLinks?: boolean
  fit?: boolean
  xtermOptions?: ITerminalOptions & ITerminalInitOnlyOptions
}

export class TerminalCore extends Disposable {
  fitAddon: FitAddon

  private webglAddon?: WebglAddon

  private canvasAddon?: CanvasAddon

  xterm: Terminal

  options: EnhancedTerminalOptions

  constructor(options: EnhancedTerminalOptions = {}) {
    super()

    this.options = {
      rendererType: 'webgl',
      webLinks: true,
      fit: true,
      ...options,
    }

    this.xterm = new Terminal({
      cursorBlink: true,
      ...this.options.xtermOptions,
    })
    // 注册后调用 this.dispose 会自动调用 this.xterm.dispose 清理
    this.register(this.xterm)
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

    // 添加 weblinks addon
    if (this.options.webLinks) {
      this.xterm.loadAddon(new WebLinksAddon())
    }

    // 初始化渲染器
    this.initRenderer()

    // 渲染
    this.xterm.open(element)

    // 实现 fit resize 能力
    if (this.options.fit) {
      this.fitAddon = new FitAddon()
      // load addon
      this.xterm.loadAddon(this.fitAddon)
      this.fit()
    }

    return this.xterm
  }

  fit = () => {
    try {
      this.fitAddon?.fit()
    } catch (e) {
      log.error('fit error', e)
    }
  }

  // 启用/禁用 resize
  // 用于 Terminal 在某个 tab 下展示, 来回切换 tab 导致 Terminal 显示异常的问题
  // 切换到其他 tab 时调用 suspend, 切换回 Terminal tab 时调用 resume
  private resizeable = true

  suspendResize() {
    this.resizeable = false
  }

  resumeResize() {
    this.resizeable = true
  }

  // 容器尺寸变化需要进行适配, 调用 fitAddon.fit() 方法
  // 为什么需要 debounce?
  // 背景: 在与 PTY/TTY 交互时, 需要保持 Terminal 和 PTY/TTY 尺寸的一致性, 适配尺寸变化会触发 terminal.onResize 回调, 在 onResize 回调中会给 PTY/TTY 发送当前的尺寸信息, 以此来保持一致 https://github.com/xtermjs/xterm.js/wiki/FAQ
  // 但是 Terminal -> PTY/TTY 之间是存在一个链路的, 在链路中传递需要一定的时间, 频繁触发 resize 会导致 Terminal 中已有文本渲染异常
  // 通过 debounce 的方式可以减少渲染异常, 但没办法完全避免, 实际用户也不会过于频繁去改变尺寸 https://github.com/xtermjs/xterm.js/issues/4489
  private debounceResizeCb = debounce(() => {
    this.resizeCb()
  }, 500)

  private resizeCb = () => {
    if (this.resizeable) {
      this.fit()
    }
  }

  // 添加 window resize 事件
  fitWindowResize(debounce = true) {
    this.register(addDisposableEventListener(window, 'resize', debounce ? this.debounceResizeCb : this.resizeCb))
    // window.addEventListener('resize', debounce ? this.debounceResizeCb : this.resizeCb)
  }

  // 阻止粘贴
  preventPaste = (cb?: () => void) => {
    if (this.xterm.textarea) {
      this.register(
        addDisposableEventListener(
          this.xterm.textarea,
          'paste',
          (e) => {
            e.preventDefault()
            // 必须阻止冒泡, 防止被 xterm 本身的事件处理器监听到
            e.stopPropagation()
            cb?.()
          },
          // 需要在捕获阶段拦截
          true,
        ),
      )
    }
  }

  // 禁用输入
  disableStdIn = () => {
    this.xterm.options.disableStdin = true
  }

  // 启用输入
  enableStdIn = () => {
    this.xterm.options.disableStdin = false
  }

  write = (data: string | Uint8Array, callback?: () => void) => this.xterm.write(data, callback)

  focus = () => this.xterm.focus()

  clear = () => this.xterm.clear()

  reset = () => this.xterm.reset()

  scrollToTop = () => this.xterm.scrollToTop()

  scrollToBottom = () => this.xterm.scrollToBottom()

  selectAll = () => this.xterm.selectAll()

  loadAddon = (addon: ITerminalAddon) => this.xterm.loadAddon(addon)

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
}
