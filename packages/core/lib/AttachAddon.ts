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

  constructor(url: string, protocols?: string | string[], options?: AttachAddonOptions) {
    super(url, protocols)
    // this._socket = socket
    // always set binary type to arraybuffer, we do not handle blobs
    this.binaryType = 'arraybuffer'

    this.processMessageToServer = options?.processMessageToServer ?? this.processMessageToServer
    this.processMessageFromServer = options?.processMessageFromServer ?? this.processMessageFromServer
  }

  activate(terminal: Terminal): void {
    // 建立连接后获取焦点
    this.addListener('open', () => {
      terminal.focus()
    })

    // 处理消息
    this.addListener('message', (ev) => {
      const data: ArrayBuffer | string = ev.data
      log.info(`received message: `, data)
      const message = this.processMessageFromServer(data)
      if (message) {
        terminal.write(message)
      }
    })
    this.attachTerminal(terminal)

    this.addListener('close', () => this.dispose())
    this.addListener('error', () => this.dispose())
  }

  attachTerminal(terminal: Terminal) {
    this._disposables.push(terminal.onData((data) => this.sendMessage('data', data)))
    this._disposables.push(terminal.onBinary((data) => this.sendMessage('binary', data)))
    this._disposables.push(terminal.onResize((data) => this.sendMessage('resize', data)))
  }

  addListener<K extends keyof WebSocketEventMap>(type: K, handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any) {
    this._disposables.push(addSocketListener(this, type, handler))
  }

  sendMessage<T extends MessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        log.info(`send ${type} message: `, message)
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
