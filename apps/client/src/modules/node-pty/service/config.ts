import { MessageData, MessageType } from '@/core/AttachAddon'

export const K8sWebsocketProtocol = 'base64.channel.k8s.io'
export const K8sExecMsgChannel = {
  StdIn: '0',
  StdOut: '1',
  StdError: '2',
  ServiceError: '3',
  Resize: '4',
}

// 生成发送给服务端的消息
export function generateMessage(type: MessageType, data: MessageData[MessageType]) {
  switch (type) {
    case 'resize':
      return JSON.stringify({ type: 'resize', content: data })
    case 'data':
      return JSON.stringify({ type: 'input', content: data })
    case 'binary':
      return JSON.stringify({ type: 'input', content: data })
    case 'heartbeat':
      return JSON.stringify({ type: 'heartbeat' })
  }
  return ''
}

// 处理服务端消息
export function processMessageFromServer(message: string | ArrayBuffer) {
  if (typeof message === 'string') {
    try {
      const data = JSON.parse(message)
      console.log('receive message', data)
      if (data.type === 'input') {
        return data.content ?? ''
      }
      return ''
    } catch (e) {
      return ''
    }
  }
  return ''
}
