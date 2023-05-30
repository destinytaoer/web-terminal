import { TrzszOptions } from 'trzsz'
import { TrzszFilter } from 'trzsz'
import { Terminal, IDisposable, ITerminalAddon } from 'xterm'
import { addSocketListener } from './utils'

export type MessageType = 'data' | 'binary' | 'resize' | 'heartbeat'

export type MessageData =
  | { type: 'data'; content: string }
  | { type: 'binary'; content: string }
  | {
      type: 'heartbeat'
      content?: any
    }
  | {
      type: 'resize'
      content: {
        cols: number
        rows: number
      }
    }
  | { type: string; content: any }

export type ProcessMessageToServerFn = (data: MessageData) => string | ArrayBufferLike | Blob | ArrayBufferView | undefined

export type ProcessMessageFromServerFn = (data: ArrayBuffer | string) => string | Uint8Array | undefined

export interface TrzszAddonOptions extends Pick<TrzszOptions, 'chooseSendFiles' | 'chooseSaveDirectory' | 'isWindowsShell'> {
  processMessageToServer?: ProcessMessageToServerFn
  processMessageFromServer?: ProcessMessageFromServerFn
}

/**
 * An addon for xterm.js that supports trzsz
 */
export class TrzszAddon extends WebSocket implements ITerminalAddon {
  private _disposables: IDisposable[] = []

  private options: TrzszAddonOptions

  private trzsz: TrzszFilter | null = null

  private processMessageToServer: ProcessMessageToServerFn = (data: MessageData) => {
    const { type, content } = data

    switch (type) {
      case 'data':
        return content
      case 'binary':
        const buffer = new Uint8Array(content.length)
        for (let i = 0; i < content.length; ++i) {
          buffer[i] = content.charCodeAt(i) & 255
        }
        return buffer
      default:
        return
    }
  }

  private processMessageFromServer: ProcessMessageFromServerFn = (data: ArrayBuffer | string) => {
    try {
      if (typeof data === 'string') {
        const obj = JSON.parse(data)
        if (obj.type === 'heartbeat') {
          return
        }
      }
    } catch (e) {}
    return typeof data === 'string' ? data : new Uint8Array(data)
  }

  /**
   * Create a TrzszAddon
   * @param {url} string - The websocket connection url.
   * @param {TrzszOptions} options - The trzsz options.
   */
  constructor(url: string, protocols: string | string[], options?: TrzszAddonOptions) {
    super(url, protocols)

    // always set binary type to arraybuffer, we do not handle blobs
    this.binaryType = 'arraybuffer'
    this.options = options || {}

    this.processMessageToServer = options?.processMessageToServer ?? this.processMessageToServer
    this.processMessageFromServer = options?.processMessageFromServer ?? this.processMessageFromServer
  }

  /**
   * Upload files or directories to the server.
   * @param {string[] | DataTransferItemList} items - The files or directories to upload.
   */
  async uploadFiles(items: string[] | DataTransferItemList) {
    if (this.trzsz) {
      return this.trzsz.uploadFiles(items)
    } else {
      throw new Error('Addon has not been activated')
    }
  }

  /**
   * Activate TrzszAddon
   * @param {Terminal} terminal - The xterm.js terminal
   */
  public activate(terminal: Terminal): void {
    const writeToTerminal = (data) => {
      terminal.write(typeof data === 'string' ? data : new Uint8Array(data))
    }
    const sendToServer = (data) => {
      this.sendMessage('data', data)
    }

    this.trzsz = new TrzszFilter({
      writeToTerminal,
      sendToServer,
      chooseSendFiles: this.options.chooseSendFiles,
      chooseSaveDirectory: this.options.chooseSaveDirectory,
      terminalColumns: terminal.cols,
      isWindowsShell: this.options.isWindowsShell,
    })

    this.attachSocket(this)
    this.attachTerminal(terminal)
  }

  attachSocket(socket: WebSocket) {
    // 建立连接后获取焦点
    // this._disposables.push(addSocketListener(socket, 'open', () => this.terminal?.focus()))
    this._disposables.push(addSocketListener(socket, 'message', (ev) => this.onMessage(ev.data)))
    this._disposables.push(addSocketListener(socket, 'close', () => this.dispose()))
    this._disposables.push(addSocketListener(socket, 'error', () => this.dispose()))
  }

  attachTerminal(terminal: Terminal) {
    this._disposables.push(terminal.onData((data) => this.trzsz.processTerminalInput(data)))
    this._disposables.push(terminal.onBinary((data) => this.trzsz.processBinaryInput(data)))
    this._disposables.push(
      terminal.onResize((data) => {
        this.trzsz.setTerminalColumns(data.cols)
        this.sendMessage('resize', data)
      }),
    )
  }

  consume(data: string | ArrayBuffer) {
    this.trzsz.processServerOutput(data)
  }

  onMessage(data: string | ArrayBuffer) {
    const message = this.processMessageFromServer(data)
    if (message) {
      this.consume(message)
    }
  }

  sendMessage<T extends MessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        this.send(message)
      }
    }
  }

  /**
   * Dispose TrzszAddon
   */
  dispose(): void {
    for (const d of this._disposables) {
      d.dispose()
    }
    this.trzsz = null
  }

  private _checkOpenSocket(): boolean {
    switch (this?.readyState) {
      case WebSocket.OPEN:
        return true
      case WebSocket.CONNECTING:
        console.error('Attach addon was loaded before socket was open')
        break
      case WebSocket.CLOSING:
        console.warn('Attach addon socket is closing')
        break
      case WebSocket.CLOSED:
        console.error('Attach addon socket is closed')
        break
      default:
        console.error('Unexpected socket state')
    }
    return false
  }
}
