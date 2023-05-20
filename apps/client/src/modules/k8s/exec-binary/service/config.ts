import { MessageData } from 'core'
import { Buffer } from 'buffer/'

export const k8s = {
  protocol: {
    base64: 'base64.channel.k8s.io',
    binary: 'channel.k8s.io',
  },
  messageChannel: {
    StdIn: 0,
    StdOut: 1,
    StdError: 2,
    ServiceError: 3,
    Resize: 4,
  },
}

// 生成发送给服务端的消息
export function processMessageToServer(data: MessageData) {
  const { type, content } = data
  switch (type) {
    case 'resize': {
      const { cols, rows } = content as any
      const msg = JSON.stringify({
        Width: cols,
        Height: rows,
      })
      const type = Uint8Array.of(k8s.messageChannel.Resize)
      const msgBuffer = Buffer.from(msg, 'utf8')
      return Buffer.concat([type, msgBuffer])
      // return k8s.messageChannel.Resize + util.base64.encode(msg)
    }
    case 'data':
    case 'binary': {
      const input = content
      const type = Uint8Array.of(k8s.messageChannel.StdIn)
      // if (typeof input === 'string') {
      const msgBuffer = Buffer.from(input, 'utf8')
      return Buffer.concat([type, msgBuffer])
      // } else {
      //   const msgBuffer = Buffer.from(input)
      //   return Buffer.concat([type, msgBuffer])
      // }
      // return k8s.messageChannel.StdIn + util.base64.encode(input)
    }
    case 'heartbeat': {
      return Uint8Array.of(k8s.messageChannel.StdIn)
    }
  }
  return ''
}

// 处理服务端消息
export function processMessageFromServer(data: string | ArrayBuffer) {
  if (typeof data === 'string') {
    // const base64Msg = data.slice(1)
    // const type = data.slice(0, 1)
    // const msg = util.base64.decode(base64Msg).toString()
    // switch (type) {
    //   case k8s.messageChannel.StdOut:
    //   case k8s.messageChannel.StdError:
    //     return msg
    //   case k8s.messageChannel.ServiceError:
    //     const reg = /exit code ([0-9]+)/
    //     const [, exitCode] = msg.match(reg) ?? []
    //     switch (exitCode) {
    //       case '137':
    //         console.error('exit code 137: pod terminated')
    //         return ''
    //       case undefined:
    //         console.error(msg)
    //         return ''
    //       default:
    //         console.error(`exit code ${exitCode}: ${msg}`)
    //         return ''
    //     }
    // }
  } else {
    const buffer = Buffer.from(data)
    const type = buffer[0]
    const content = buffer.slice(1).toString('utf8')
    switch (type) {
      case k8s.messageChannel.StdOut:
      case k8s.messageChannel.StdError:
        return content
      case k8s.messageChannel.ServiceError:
        const reg = /exit code ([0-9]+)/
        const msg = content
        const [, exitCode] = msg.match(reg) ?? []
        switch (exitCode) {
          case '137':
            console.error('exit code 137: pod terminated')
            return ''
          case undefined:
            console.error(msg)
            return ''
          default:
            console.error(`exit code ${exitCode}: ${msg}`)
            return ''
        }
    }
  }
  return ''
}

// https://github.com/aws/aws-sdk-js/blob/master/lib/util.js
export const util = {
  base64: {
    encode: function encode64(string: string) {
      if (typeof string === 'number') {
        throw new Error('Cannot base64 encode number ' + string)
      }
      if (string === null || typeof string === 'undefined') {
        return string
      }
      return util.buffer.toBuffer(string).toString('base64')
    },

    decode: function decode64(string: string) {
      if (typeof string === 'number') {
        throw new Error('Cannot base64 decode number ' + string)
      }
      if (string === null || typeof string === 'undefined') {
        return string
      }
      return util.buffer.toBuffer(string, 'base64')
    },
  },
  Buffer: Buffer,
  buffer: {
    /**
     * Buffer constructor for Node buffer and buffer pollyfill
     */
    toBuffer: function (data: string, encoding?: string) {
      return typeof util.Buffer.from === 'function' && util.Buffer.from !== Uint8Array.from
        ? util.Buffer.from(data, encoding)
        : new util.Buffer(data, encoding)
    },
  },
}
