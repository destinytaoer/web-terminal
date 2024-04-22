import { ITerminalAddon, ITerminalInitOnlyOptions, ITerminalOptions, Terminal } from '@xterm/xterm'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon, ISearchOptions, ISearchAddonOptions } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { addDisposableEventListener, Disposable, detectWebGLContext, log, toDisposable } from '../utils'
import { debounce, omit, merge } from 'lodash'
import { DEFAULT_XTERM_OPTIONS, DEFAULT_SEARCH_OPTIONS } from './config'

export interface EnhancedTerminalOptions {
  rendererType?: 'dom' | 'canvas' | 'webgl'
  fit?: boolean
  search?: boolean
  searchOptions?: ISearchOptions & Partial<ISearchAddonOptions>
  xtermOptions?: ITerminalOptions & ITerminalInitOnlyOptions
}

export class TerminalCore extends Disposable {
  fitAddon?: FitAddon

  private webglAddon?: WebglAddon

  private canvasAddon?: CanvasAddon

  searchAddon?: SearchAddon

  searchOptions: ISearchOptions

  xterm?: Terminal

  options: EnhancedTerminalOptions

  element?: HTMLElement

  constructor(options: EnhancedTerminalOptions = {}) {
    super()

    this.options = {
      rendererType: 'webgl',
      fit: true,
      search: false,
      ...options,
    }

    this.options.xtermOptions = merge(DEFAULT_XTERM_OPTIONS, this.options.xtermOptions)
    this.searchOptions = merge(DEFAULT_SEARCH_OPTIONS, omit(this.options.searchOptions, 'highlightLimit'))
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

    this.element = element

    this.xterm = new Terminal(this.options.xtermOptions)
    // 注册后调用 this.dispose 会自动调用 this.xterm.dispose 清理
    this.register(this.xterm)

    // 添加 weblinks addon
    this.xterm.loadAddon(new WebLinksAddon())

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

    // 传入参数, 限制显示高亮的数量
    if (this.options.search) {
      this.searchAddon = new SearchAddon({ highlightLimit: this.options.searchOptions?.highlightLimit })
      this.xterm.loadAddon(this.searchAddon)
    }

    this.register(
      toDisposable(() => {
        this.element = undefined
        this.xterm = undefined
        this.fitAddon = undefined
        this.searchAddon = undefined
      }),
    )

    return this.xterm
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

  fit = () => {
    this.throwFitError()
    if (!this.resizeable) return
    try {
      this.fitAddon?.fit()
    } catch (e) {
      log.error('fit error', e)
    }
  }

  // 容器尺寸变化需要进行适配, 调用 fitAddon.fit() 方法
  // 为什么需要 debounce?
  // 背景: 在与 PTY/TTY 交互时, 需要保持 Terminal 和 PTY/TTY 尺寸的一致性, 适配尺寸变化会触发 terminal.onResize 回调, 在 onResize 回调中会给 PTY/TTY 发送当前的尺寸信息, 以此来保持一致 https://github.com/xtermjs/xterm.js/wiki/FAQ
  // 但是 Terminal -> PTY/TTY 之间是存在一个链路的, 在链路中传递需要一定的时间, 频繁触发 resize 会导致 Terminal 中已有文本渲染异常
  // 通过 debounce 的方式可以减少渲染异常, 但没办法完全避免, 实际用户也不会过于频繁去改变尺寸 https://github.com/xtermjs/xterm.js/issues/4489
  fitDebounce = debounce(() => {
    this.throwFitError()
    this.fit()
  }, 500)

  // 添加 window resize 事件
  fitWindowResize = (debounce = true) => {
    this.register(addDisposableEventListener(window, 'resize', debounce ? this.fitDebounce : this.fit))
    // window.addEventListener('resize', debounce ? this.debounceResizeCb : this.resizeCb)
  }

  // 添加当前 dom resize
  fitDomResize = (debounce = true) => {
    this.throwInitError()
    if (!window.ResizeObserver) {
      log.error('Current browser is not support ResizeObserver, fallback to window resize event, please handle other resize yourself!')
      this.fitWindowResize()
      return
    }

    const resizeObserver = new window.ResizeObserver(() => {
      if (debounce) {
        this.fitDebounce()
      } else {
        this.fit()
      }
    })

    resizeObserver.observe(this.element!)

    this.register(toDisposable(() => resizeObserver.disconnect()))
  }

  // 阻止粘贴
  preventPaste = (cb?: () => void) => {
    if (this.xterm?.textarea) {
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
    this.throwInitError()
    this.xterm!.options.disableStdin = true
  }

  // 启用输入
  enableStdIn = () => {
    this.throwInitError()
    this.xterm!.options.disableStdin = false
  }

  // search 相关
  // 查找下一个
  findNext = (keyword: string, searchOptions?: ISearchOptions) => {
    this.throwSearchError()
    if (searchOptions) this.changeSearchOptions(searchOptions)
    this.searchAddon!.findNext(keyword, this.searchOptions)
  }

  // 查找上一个
  findPrevious = (keyword: string, searchOptions?: ISearchOptions) => {
    this.throwSearchError()
    if (searchOptions) this.changeSearchOptions(searchOptions)
    this.searchAddon!.findPrevious(keyword, this.searchOptions)
  }

  // 修改查找配置
  changeSearchOptions = (searchOptions: ISearchOptions) => {
    this.searchOptions = merge(this.searchOptions, searchOptions)
  }

  // 退出查找
  exitSearch = () => {
    this.throwSearchError()
    this.searchAddon?.clearDecorations()
    this.xterm?.clearSelection()
  }

  write = (data: string | Uint8Array, callback?: () => void) => this.xterm?.write(data, callback)

  focus = () => this.xterm?.focus()

  clear = () => this.xterm?.clear()

  reset = () => this.xterm?.reset()

  scrollToTop = () => this.xterm?.scrollToTop()

  scrollToBottom = () => this.xterm?.scrollToBottom()

  selectAll = () => this.xterm?.selectAll()

  loadAddon = (addon: ITerminalAddon) => this.xterm?.loadAddon(addon)

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

  private throwFitError() {
    if (!this.fitAddon) throw new Error("Please init the terminal first and open the 'fit' option to use this method")
  }

  private throwSearchError() {
    if (!this.searchAddon) throw new Error("Please init the terminal first and  open the 'search' option to use this method")
  }

  private throwInitError() {
    if (!this.element || !this.xterm) throw new Error('Please init the terminal first')
  }
}
