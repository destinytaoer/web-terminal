import { IDisposable, ITerminalAddon, Terminal } from '@xterm/xterm'
import { addSocketListener, log } from '../utils'

// 发送消息的类型
export type SendMessageType = 'data' | 'binary' | 'resize' | 'heartbeat'

export type SendMessageData =
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

export type ProcessMessageToServerFn = (data: SendMessageData) => string | ArrayBufferLike | Blob | ArrayBufferView | undefined

export type ProcessMessageFromServerFn = (data: ArrayBuffer | string) => string | Uint8Array

type Writer = (data: string | Uint8Array) => void

export interface AttachAddonOptions {
  processMessageToServer?: ProcessMessageToServerFn
  processMessageFromServer?: ProcessMessageFromServerFn
  writer: Writer
}

export class AttachAddon implements ITerminalAddon {
  private _disposables: IDisposable[] = []

  private socket: WebSocket

  private writer: Writer

  private processMessageToServer: ProcessMessageToServerFn

  private processMessageFromServer: ProcessMessageFromServerFn

  constructor(socket: WebSocket, options: AttachAddonOptions) {
    // always set binary type to arraybuffer, we do not handle blobs
    socket.binaryType = 'arraybuffer'

    this.socket = socket
    this.writer = options.writer
    this.processMessageToServer = options.processMessageToServer
    this.processMessageFromServer = options.processMessageFromServer
  }

  activate(terminal: Terminal): void {
    // 处理 server 消息
    this.attachSocket(this.socket)

    // 处理 client 消息
    this.attachTerminal(terminal)
  }

  attachSocket(socket: WebSocket) {
    this._disposables.push(addSocketListener(socket, 'message', (ev) => this.onMessage(ev.data)))
    this._disposables.push(addSocketListener(socket, 'close', () => this.dispose()))
    this._disposables.push(addSocketListener(socket, 'error', () => this.dispose()))
  }

  attachTerminal(terminal: Terminal) {
    log.info('terminal', terminal)
    this._disposables.push(terminal.onData((data) => this.sendMessage('data', data)))
    this._disposables.push(terminal.onBinary((data) => this.sendMessage('binary', data)))
    this._disposables.push(terminal.onResize((data) => this.sendMessage('resize', data)))
  }

  onMessage(data: string | ArrayBuffer) {
    const message = this.processMessageFromServer(data)

    if (message) {
      this.writer(message)
    }
  }

  sendMessage<T extends SendMessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        this.socket.send(message)
      }
    }
  }

  dispose(): void {
    if (this._checkOpenSocket()) {
      this.socket.close(1000, 'frontend close')
    }
    for (const d of this._disposables) {
      d.dispose()
    }
  }

  private _checkOpenSocket(): boolean {
    switch (this.socket?.readyState) {
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
