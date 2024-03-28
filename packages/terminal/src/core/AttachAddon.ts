import { ITerminalAddon, Terminal } from '@xterm/xterm'
import { addSocketListener, createHeartbeat, Disposable, toDisposable, log, EventHandler, addEventEmitterListener, EventEmitter } from '../utils'

// 接收消息的类型
export type ReceiveMessageType = 'stdout' | 'heartbeat' | 'error'

export type ReceiveMessageData = {
  type: ReceiveMessageType
  message?: string | Uint8Array
  error?: any
}

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

export type ProcessMessageFromServerFn = (data: ArrayBuffer | string) => ReceiveMessageData

type Writer = (data: string | Uint8Array) => void

export interface AttachAddonOptions {
  processMessageToServer?: ProcessMessageToServerFn
  processMessageFromServer?: ProcessMessageFromServerFn
  heartbeatTime?: number | false
  writer: Writer
}

export class AttachAddon extends Disposable implements ITerminalAddon {
  private socket: WebSocket

  private writer: Writer

  private eventEmitter: EventEmitter

  private processMessageToServer: ProcessMessageToServerFn

  private processMessageFromServer: ProcessMessageFromServerFn

  private heartbeatTime: number | false

  constructor(socket: WebSocket, options: AttachAddonOptions) {
    super()
    // always set binary type to arraybuffer, we do not handle blobs
    socket.binaryType = 'arraybuffer'

    this.socket = socket
    this.eventEmitter = new EventEmitter()
    this.writer = options.writer
    this.heartbeatTime = options.heartbeatTime
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
    this.register(addSocketListener(socket, 'message', (ev) => this.onMessage(ev.data)))
    this.register(addSocketListener(socket, 'close', () => this.dispose()))
    this.register(addSocketListener(socket, 'error', () => this.dispose()))
    if (this.heartbeatTime) this.addHeartbeat(this.heartbeatTime)
    this.register(
      toDisposable(() => {
        // 手动关闭时, 前端发送关闭码
        if (this._checkOpenSocket()) {
          log.info('socket close by frontend')
          this.socket.close(1000, 'frontend close')
          this.socket = null
        }
      }),
    )
  }

  attachTerminal(terminal: Terminal) {
    this.register(terminal.onData((data) => this.sendMessage('data', data)))
    this.register(terminal.onBinary((data) => this.sendMessage('binary', data)))
    this.register(terminal.onResize((data) => this.sendMessage('resize', data)))
  }

  onMessage(data: string | ArrayBuffer) {
    const content = this.processMessageFromServer(data)
    const { type, message, error } = content

    this.eventEmitter.emit(`service:${type}`, content)

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

  on(event: string, fn: EventHandler) {
    return this.register(addEventEmitterListener(this.eventEmitter, event, fn))
  }

  private addHeartbeat(heartbeatTime: number) {
    // 添加心跳
    const heartbeat = createHeartbeat(() => {
      log.info('send heartbeat', new Date().toLocaleString())
      this.sendMessage('heartbeat')
    }, heartbeatTime)

    this.register(
      addSocketListener(this.socket, 'open', () => {
        log.info('heartbeat start')
        heartbeat.start()
      }),
    )
    this.register(
      toDisposable(() => {
        log.info('heartbeat stop')
        heartbeat.stop()
      }),
    )
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
