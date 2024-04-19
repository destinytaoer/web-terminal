import { ITerminalAddon, Terminal } from '@xterm/xterm'
import { toDisposable, Disposable, log, EventEmitter, addSocketListener, addEventEmitterListener, EventHandler, createHeartbeat } from '../utils'

// 接收消息的类型
export type ReceiveMessageType = 'stdout' | 'heartbeat' | 'error' | string

export type ReceiveMessageData =
  | {
      type: 'stdout'
      content?: string | Uint8Array
    }
  | { type: 'heartbeat'; content?: any }
  | { type: 'error'; content?: string | Uint8Array; error: any }

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

export abstract class AttachAddon extends Disposable implements ITerminalAddon {
  socket: WebSocket

  private eventEmitter: EventEmitter

  heartbeatTime?: number

  private terminal?: Terminal

  constructor(socket: WebSocket) {
    super()
    // always set binary type to arraybuffer, we do not handle blobs
    socket.binaryType = 'arraybuffer'

    this.socket = socket
    this.eventEmitter = new EventEmitter()
  }

  activate(terminal: Terminal): void {
    this.terminal = terminal

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
          log.success('socket close by frontend')
          this.socket.close(1000, 'frontend close')
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
    const message = this.processMessageFromServer(data)

    const { type, content } = message

    this.eventEmitter.emit(`service:${type}`, message)

    if (content) {
      this.writer(content)
    }
  }

  writer = (content: string | Uint8Array) => {
    this.terminal?.write(content)
  }

  sendMessage<T extends SendMessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        this.socket.send(message)
      }
    }
  }

  on(event: ReceiveMessageType, fn: EventHandler) {
    return this.register(addEventEmitterListener(this.eventEmitter, event, fn))
  }

  abstract processMessageToServer: ProcessMessageToServerFn
  abstract processMessageFromServer: ProcessMessageFromServerFn

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
        log.error('Attach addon was loaded before socket was open')
        break
      case WebSocket.CLOSING:
        log.warn('Attach addon socket is closing')
        break
      case WebSocket.CLOSED:
        log.error('Attach addon socket is closed')
        break
      default:
        log.error('Unexpected socket state')
    }
    return false
  }
}
