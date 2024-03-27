import { EnhancedTerminalOptions, TerminalCore } from './TerminalCore'
import { AttachAddon, AttachAddonOptions, SendMessageType } from './AttachAddon'
import { addEventEmitterListener, addSocketListener, addDisposableEventListener, EventEmitter, EventHandler, createHeartbeat, log } from '../utils'

type ConnectSocketOptions = Pick<AttachAddonOptions, 'processMessageFromServer' | 'processMessageToServer'> & {
  url: string
  protocols?: string | string[]
}

export class WebTerminal extends TerminalCore {
  socket?: WebSocket

  private eventEmitter: EventEmitter

  private attachAddon?: AttachAddon

  constructor(options: EnhancedTerminalOptions = {}) {
    super(options)
    this.eventEmitter = new EventEmitter()
  }

  connectSocket(options: ConnectSocketOptions) {
    const { url, protocols, processMessageFromServer, processMessageToServer } = options
    const socket = new WebSocket(url, protocols)
    this.socket = socket

    const attachAddon = new AttachAddon(socket, {
      processMessageFromServer,
      processMessageToServer,
      heartbeatTime: 15 * 1000,
      emit: this.eventEmitter.emit.bind(this.eventEmitter),
      writer: this.writer.bind(this),
    })
    this.attachAddon = attachAddon

    // loadAddon 的时候调用 addon 的 activate, 传入参数 terminal
    this.loadAddon(attachAddon)

    this.registerListeners()

    return socket
  }

  registerListeners() {
    this.register(
      addSocketListener(this.socket, 'open', () => {
        log.success('socket open')
        this.focus()
      }),
    )
    this.register(
      addSocketListener(this.socket, 'error', () => {
        this.write('Connect Error.')
      }),
    )

    this.register(
      addSocketListener(this.socket, 'close', () => {
        this.write('disconnect.')
      }),
    )
  }

  sendMessage(type: SendMessageType, data?: any) {
    this.attachAddon?.sendMessage(type, data)
  }

  on(event: string, fn: EventHandler) {
    this.register(addEventEmitterListener(this.eventEmitter, event, fn))
  }

  writer(data: string | Uint8Array, callback?: () => void) {
    this.write(data, callback)
  }
}
