import { AttachAddon, ReceiveMessageData, SendMessageData } from '../../core'
import { Buffer } from 'buffer'
import { HeartbeatTime } from './config'

export class PtyAttachAddon extends AttachAddon {
  heartbeatTime = HeartbeatTime

  // 生成发送给服务端的消息
  processMessageToServer = (data: SendMessageData) => {
    // log.warn('to server', data)
    const { type, content } = data
    switch (type) {
      case 'resize':
        return JSON.stringify({ type: 'resize', content })
      case 'data':
      case 'binary':
        return content
      case 'heartbeat':
        return JSON.stringify({ type: 'heartbeat' })
    }
    return ''
  }

  // 处理服务端消息
  processMessageFromServer = (message: string | ArrayBuffer): ReceiveMessageData => {
    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message)
        if (data.type === 'input') {
          return { type: 'stdout', content: data.content ?? '' }
        }
        return { type: 'stdout', content: data.content ?? '' }
      } catch (e) {
        return { type: 'error', error: e }
      }
    } else {
      const buffer = Buffer.from(message)
      const content = buffer.toString()
      // log.info('receive message from server', content)
      return { type: 'stdout', content: buffer }
    }
  }
}
