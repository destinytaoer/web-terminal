import { AttachAddon, ReceiveMessageType, SendMessageData } from '../../core'
import { log } from '../../utils'
import { MessageChannel, HeartbeatTime } from './config'
import { Buffer } from 'buffer/'

export class ExecAttachAddon extends AttachAddon {
  textDecoder = new TextDecoder()

  heartbeatTime = HeartbeatTime

  // 处理服务端消息回显
  processMessageFromServer = (data: string | ArrayBuffer) => {
    if (typeof data === 'string') {
      log.warn('something error')
      return {
        type: ReceiveMessageType.ERROR,
        error: { message: 'Type of receive data from server is string, please make it binary' },
      }
    }

    const buffer = new Uint8Array(data)
    const type = buffer[0]
    const content = buffer.slice(1)
    switch (type) {
      case MessageChannel.StdIn:
        return { type: ReceiveMessageType.HEARTBEAT }
      case MessageChannel.StdOut:
      case MessageChannel.StdError:
        return { type: ReceiveMessageType.STDOUT, content }
      case MessageChannel.ServiceError:
        const reg = /exit code ([0-9]+)/
        const msg = this.textDecoder.decode(content)
        const [, exitCode] = msg.match(reg) ?? []
        switch (exitCode) {
          case '137':
            const message = 'exit code 137: pod terminated'
            log.error(message)
            return {
              type: ReceiveMessageType.ERROR,
              error: { message, exitCode: 137 },
            }
          case undefined:
            log.error(msg)
            return { type: ReceiveMessageType.ERROR, error: { message: msg } }
          default:
            log.error(`exit code ${exitCode}: ${msg}`)
            return { type: ReceiveMessageType.ERROR, error: { message: msg, exitCode } }
        }
    }

    log.error('Unhandled message channel')
    return { type: ReceiveMessageType.ERROR, error: { message: 'Unhandled message channel' } }
  }

  // 生成发送给服务端的消息
  processMessageToServer = (data: SendMessageData) => {
    const { type, content } = data
    switch (type) {
      case 'resize': {
        const { cols, rows } = content
        const msg = JSON.stringify({
          Width: cols,
          Height: rows,
        })
        const type = Buffer.from(Uint8Array.of(MessageChannel.Resize))
        const msgBuffer = Buffer.from(msg, 'utf8')
        return Buffer.concat([type, msgBuffer])
      }
      case 'data':
      case 'binary': {
        const type = Buffer.from(Uint8Array.of(MessageChannel.StdIn))
        const msgBuffer = Buffer.from(content, 'utf8')
        return Buffer.concat([type, msgBuffer])
      }
      case 'heartbeat': {
        return Buffer.from(Uint8Array.of(MessageChannel.StdIn))
      }
    }
    return ''
  }
}
