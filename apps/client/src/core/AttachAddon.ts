import { Terminal, IDisposable, ITerminalAddon } from 'xterm'
import { addSocketListener } from './utils'

export type MessageType = 'data' | 'binary' | 'resize' | 'heartbeat'
export type MessageData = {
  resize: {
    cols: number
    rows: number
  }
  data: string
  binary: string
  heartbeat: string
}
export type SendMessageMapper = (
  type: MessageType,
  data: MessageData[MessageType],
) => string | ArrayBufferLike | Blob | ArrayBufferView | undefined

export type OnmessageMapper = (data: ArrayBuffer | string) => string | Uint8Array | undefined

export interface AttachAddonOptions {
  sendMessageMapper?: SendMessageMapper
  onmessageMapper?: OnmessageMapper
}

export class AttachAddon extends WebSocket implements ITerminalAddon {
  private _disposables: IDisposable[] = []

  private _sendMessageMapper: SendMessageMapper = (type: MessageType, data?: any) => {
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

  private _onmessageMapper: OnmessageMapper = (data: ArrayBuffer | string) => {
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

    this._sendMessageMapper = options?.sendMessageMapper ?? this._sendMessageMapper
    this._onmessageMapper = options?.onmessageMapper ?? this._onmessageMapper
  }

  public activate(terminal: Terminal): void {
    this.addListener('message', (ev) => {
      const data: ArrayBuffer | string = ev.data
      const message = this._onmessageMapper(data)
      if (message) terminal.write(message)
    })

    this._disposables.push(terminal.onData((data) => this.sendMessage('data', data)))
    this._disposables.push(terminal.onBinary((data) => this.sendMessage('binary', data)))

    // this.addListener('close', () => this.dispose())
    // this.addListener('error', () => this.dispose())
  }

  public addListener<K extends keyof WebSocketEventMap>(
    type: K,
    handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
  ) {
    this._disposables.push(addSocketListener(this, type, handler))
  }

  public sendMessage(type: MessageType, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this._sendMessageMapper(type, data)
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
