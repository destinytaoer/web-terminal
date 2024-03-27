import { EnhancedTerminalOptions, TerminalCore } from './TerminalCore'
import { AttachAddon, AttachAddonOptions } from './AttachAddon'
import { addEventEmitterListener, EventEmitter, EventHandler } from '../utils'

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

    const attachAddon = new AttachAddon(socket, {
      processMessageFromServer,
      processMessageToServer,
      emit: this.eventEmitter.emit,
      writer: this.writer,
    })
    this.attachAddon = attachAddon

    // loadAddon 的时候调用 addon 的 activate, 传入参数 terminal
    this.loadAddon(attachAddon)

    return (this.socket = socket)
  }

  on(event: string, fn: EventHandler) {
    this.register(addEventEmitterListener(this.eventEmitter, event, fn))
  }

  addEventListener(event: string, fn: () => {}) {}

  writer(data: string | Uint8Array) {
    this.write(data)
  }
}
