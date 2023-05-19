import { IDisposable, ITerminalAddon, Terminal } from 'xterm'
import { addSocketListener, log } from './utils'

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

export interface AttachAddonOptions {
  processMessageToServer?: ProcessMessageToServerFn
  processMessageFromServer?: ProcessMessageFromServerFn
  writer: (data: string | Uint8Array) => void
}

export class AttachAddon extends WebSocket implements ITerminalAddon {
  private _disposables: IDisposable[] = []

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

  private writer: (data: string | Uint8Array) => void

  constructor(url: string, protocols: string | string[], options: AttachAddonOptions) {
    super(url, protocols)

    // always set binary type to arraybuffer, we do not handle blobs
    this.binaryType = 'arraybuffer'

    this.processMessageToServer = options?.processMessageToServer ?? this.processMessageToServer
    this.processMessageFromServer = options?.processMessageFromServer ?? this.processMessageFromServer
    this.writer = options.writer
  }

  activate(terminal: Terminal): void {
    // 处理 server 消息
    this.attachSocket(this)

    // 处理 client 消息
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
    this._disposables.push(terminal.onData((data) => this.sendMessage('data', data)))
    this._disposables.push(terminal.onBinary((data) => this.sendMessage('binary', data)))
    this._disposables.push(terminal.onResize((data) => this.sendMessage('resize', data)))
  }

  onMessage(data: string | ArrayBuffer) {
    const message = this.processMessageFromServer(data)
    log.info(`received message: `, message)
    if (message) {
      this.writer(message)
    }
  }

  sendMessage<T extends MessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        log.info(`send ${type} message: `, data)
        this.send(message)
      }
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose()
    }
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
