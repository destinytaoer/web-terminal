import { EnhancedTerminalOptions, TerminalCore } from './TerminalCore'
import { AttachAddon, AttachAddonOptions, SendMessageType } from './AttachAddon'
import { addSocketListener, EventHandler, log } from '../utils'

type ConnectSocketOptions = Pick<AttachAddonOptions, 'processMessageFromServer' | 'processMessageToServer' | 'heartbeatTime'> & {
  url: string
  protocols?: string | string[]
}

export class WebTerminal extends TerminalCore {
  socket?: WebSocket

  private attachAddon?: AttachAddon

  constructor(options: EnhancedTerminalOptions = {}) {
    super(options)
  }

  connectSocket(options: ConnectSocketOptions) {
    const { url, protocols, processMessageFromServer, processMessageToServer, heartbeatTime = false } = options
    const socket = new WebSocket(url, protocols)
    this.socket = socket

    const attachAddon = new AttachAddon(socket, {
      processMessageFromServer,
      processMessageToServer,
      heartbeatTime,
      writer: this.writer.bind(this),
    })
    this.attachAddon = attachAddon

    // loadAddon 的时候调用 addon 的 activate, 传入参数 terminal
    this.loadAddon(attachAddon)

    return socket
  }

  sendMessage(type: SendMessageType, data?: any) {
    this.attachAddon?.sendMessage(type, data)
  }

  on(event: string, fn: EventHandler) {
    return this.attachAddon?.on(event, fn)
  }

  writer(data: string | Uint8Array, callback?: () => void) {
    this.write(data, callback)
  }
}
