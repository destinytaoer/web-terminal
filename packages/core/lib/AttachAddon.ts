import { Terminal, IDisposable, ITerminalAddon } from 'xterm'
import { addSocketListener } from './utils'

export type MessageDataMap = {
  resize: {
    cols: number
    rows: number
  }
  data: string
  binary: string
  heartbeat: string
}
export type MessageType = keyof MessageDataMap

export type SendMessageMapper = (
  type: MessageType,
  data?: MessageDataMap[MessageType],
) => string | ArrayBufferLike | Blob | ArrayBufferView | undefined

export type OnmessageMapper = (data: ArrayBuffer | string) => string | Uint8Array | undefined

export interface AttachAddonOptions {
  processMsgSendToServer?: SendMessageMapper
  processMsgFromServer?: OnmessageMapper
}

export class AttachAddon extends WebSocket implements ITerminalAddon {
  private _disposables: IDisposable[] = []

  private _processMsgSendToServer: SendMessageMapper = (type: MessageType, data?: any) => {
    switch (type) {
      case 'data':
        return data
      case 'binary':
        const buffer = new Uint8Array(data.length)
        for (let i = 0; i < data.length; ++i) {
          buffer[i] = data.charCodeAt(i) & 255
        }
        return buffer
      default:
        return
    }
  }

  private _processMsgFromServer: OnmessageMapper = (data: ArrayBuffer | string) => {
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

    this._processMsgSendToServer = options?.processMsgSendToServer ?? this._processMsgSendToServer
    this._processMsgFromServer = options?.processMsgFromServer ?? this._processMsgFromServer
  }

  public activate(terminal: Terminal): void {
    // 建立连接后获取焦点
    this.addListener('open', () => {
      terminal.focus()
    })

    // 处理消息
    this.addListener('message', (ev) => {
      const data: ArrayBuffer | string = ev.data
      const message = this._processMsgFromServer(data)
      if (message) terminal.write(message)
    })
    this.attachTerminal(terminal)

    this.addListener('close', () => this.dispose())
    this.addListener('error', () => this.dispose())
  }

  public attachTerminal(terminal: Terminal) {
    this._disposables.push(terminal.onData((data) => this.sendMessage('data', data)))
    this._disposables.push(terminal.onBinary((data) => this.sendMessage('binary', data)))
    this._disposables.push(terminal.onResize((data) => this.sendMessage('resize', data)))
  }

  public addListener<K extends keyof WebSocketEventMap>(type: K, handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any) {
    this._disposables.push(addSocketListener(this, type, handler))
  }

  public sendMessage<T extends MessageType>(type: T, data?: MessageDataMap[T]) {
    if (this._checkOpenSocket()) {
      const message = this._processMsgSendToServer(type, data)
      if (message) this.send(message)
    }
  }

  public dispose(): void {
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
