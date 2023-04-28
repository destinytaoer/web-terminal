import { MessageDataMap, MessageType } from 'core'

export const K8sWebsocketProtocol = 'base64.channel.k8s.io'
export const K8sExecMsgChannel = {
  StdIn: '0',
  StdOut: '1',
  StdError: '2',
  ServiceError: '3',
  Resize: '4',
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
      const unit8 = util.buffer.strToUTF8Arr(string)
      return util.buffer.base64EncArr(unit8)
    },

    decode: function decode64(string: string) {
      if (typeof string === 'number') {
        throw new Error('Cannot base64 decode number ' + string)
      }
      if (string === null || typeof string === 'undefined') {
        return string
      }
      const unit8 = util.buffer.base64DecToArr(string)
      return util.buffer.UTF8ArrToStr(unit8)
    },
  },
  buffer: {
    /**
     * https://developer.mozilla.org/zh-CN/docs/Glossary/Base64
     */
    // Array of bytes to Base64 string decoding
    b64ToUint6(nChr: number) {
      return nChr > 64 && nChr < 91
        ? nChr - 65
        : nChr > 96 && nChr < 123
        ? nChr - 71
        : nChr > 47 && nChr < 58
        ? nChr + 4
        : nChr === 43
        ? 62
        : nChr === 47
        ? 63
        : 0
    },
    // 如果你的目标是构建 16 位/ 32 位/ 64 位原始数据的缓冲区，使用 nBlocksSize 参数，这是 uint8Array.buffer.bytesLength 属性必须产生的字节数的倍数［1 或省略为 ASCII、二进制字符串（即字符串中的每个字符都被当作二进制数据的一个字节来处理）或 UTF-8 编码的字符串，2 用于 UTF-16 字符串，4 用于 UTF-32 字符串］。
    base64DecToArr(sBase64: string, nBlocksSize?: number) {
      const sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, '') // Remove any non-base64 characters, such as trailing "=", whitespace, and more.
      const nInLen = sB64Enc.length
      const nOutLen = nBlocksSize ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize : (nInLen * 3 + 1) >> 2
      const taBytes = new Uint8Array(nOutLen)

      let nMod3
      let nMod4
      let nUint24 = 0
      let nOutIdx = 0
      for (let nInIdx = 0; nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3
        nUint24 |= util.buffer.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (6 * (3 - nMod4))
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
          nMod3 = 0
          while (nMod3 < 3 && nOutIdx < nOutLen) {
            taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255
            nMod3++
            nOutIdx++
          }
          nUint24 = 0
        }
      }

      return taBytes
    },

    /* Base64 string to array encoding */
    uint6ToB64(nUint6: number) {
      return nUint6 < 26 ? nUint6 + 65 : nUint6 < 52 ? nUint6 + 71 : nUint6 < 62 ? nUint6 - 4 : nUint6 === 62 ? 43 : nUint6 === 63 ? 47 : 65
    },
    base64EncArr(aBytes: Uint8Array) {
      let nMod3 = 2
      let sB64Enc = ''

      const nLen = aBytes.length
      let nUint24 = 0
      for (let nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3
        // To break your base64 into several 80-character lines, add:
        //   if (nIdx > 0 && ((nIdx * 4) / 3) % 76 === 0) {
        //      sB64Enc += "\r\n";
        //    }

        nUint24 |= aBytes[nIdx] << ((16 >>> nMod3) & 24)
        if (nMod3 === 2 || aBytes.length - nIdx === 1) {
          sB64Enc += String.fromCodePoint(
            util.buffer.uint6ToB64((nUint24 >>> 18) & 63),
            util.buffer.uint6ToB64((nUint24 >>> 12) & 63),
            util.buffer.uint6ToB64((nUint24 >>> 6) & 63),
            util.buffer.uint6ToB64(nUint24 & 63),
          )
          nUint24 = 0
        }
      }
      return sB64Enc.substring(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==')
    },

    /* UTF-8 array to JS string and vice versa */
    UTF8ArrToStr(aBytes: Uint8Array) {
      let sView = ''
      let nPart
      const nLen = aBytes.length
      for (let nIdx = 0; nIdx < nLen; nIdx++) {
        nPart = aBytes[nIdx]
        sView += String.fromCodePoint(
          nPart > 251 && nPart < 254 && nIdx + 5 < nLen /* six bytes */
            ? /* (nPart - 252 << 30) may be not so safe in ECMAScript! So…: */
              (nPart - 252) * 1073741824 +
                ((aBytes[++nIdx] - 128) << 24) +
                ((aBytes[++nIdx] - 128) << 18) +
                ((aBytes[++nIdx] - 128) << 12) +
                ((aBytes[++nIdx] - 128) << 6) +
                aBytes[++nIdx] -
                128
            : nPart > 247 && nPart < 252 && nIdx + 4 < nLen /* five bytes */
            ? ((nPart - 248) << 24) +
              ((aBytes[++nIdx] - 128) << 18) +
              ((aBytes[++nIdx] - 128) << 12) +
              ((aBytes[++nIdx] - 128) << 6) +
              aBytes[++nIdx] -
              128
            : nPart > 239 && nPart < 248 && nIdx + 3 < nLen /* four bytes */
            ? ((nPart - 240) << 18) + ((aBytes[++nIdx] - 128) << 12) + ((aBytes[++nIdx] - 128) << 6) + aBytes[++nIdx] - 128
            : nPart > 223 && nPart < 240 && nIdx + 2 < nLen /* three bytes */
            ? ((nPart - 224) << 12) + ((aBytes[++nIdx] - 128) << 6) + aBytes[++nIdx] - 128
            : nPart > 191 && nPart < 224 && nIdx + 1 < nLen /* two bytes */
            ? ((nPart - 192) << 6) + aBytes[++nIdx] - 128
            : /* nPart < 127 ? */ /* one byte */
              nPart,
        )
      }
      return sView
    },
    strToUTF8Arr(sDOMStr: string) {
      let aBytes: Uint8Array
      let nChr: number
      const nStrLen = sDOMStr.length
      let nArrLen = 0

      /* mapping… */
      for (let nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
        nChr = sDOMStr.codePointAt(nMapIdx)!

        if (nChr >= 0x10000) {
          nMapIdx++
        }

        nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6
      }

      aBytes = new Uint8Array(nArrLen)

      /* transcription… */
      let nIdx = 0
      let nChrIdx = 0
      while (nIdx < nArrLen) {
        nChr = sDOMStr.codePointAt(nChrIdx)!
        if (nChr < 128) {
          /* one byte */
          aBytes[nIdx++] = nChr
        } else if (nChr < 0x800) {
          /* two bytes */
          aBytes[nIdx++] = 192 + (nChr >>> 6)
          aBytes[nIdx++] = 128 + (nChr & 63)
        } else if (nChr < 0x10000) {
          /* three bytes */
          aBytes[nIdx++] = 224 + (nChr >>> 12)
          aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63)
          aBytes[nIdx++] = 128 + (nChr & 63)
        } else if (nChr < 0x200000) {
          /* four bytes */
          aBytes[nIdx++] = 240 + (nChr >>> 18)
          aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63)
          aBytes[nIdx++] = 128 + (nChr & 63)
          nChrIdx++
        } else if (nChr < 0x4000000) {
          /* five bytes */
          aBytes[nIdx++] = 248 + (nChr >>> 24)
          aBytes[nIdx++] = 128 + ((nChr >>> 18) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63)
          aBytes[nIdx++] = 128 + (nChr & 63)
          nChrIdx++
        } /* if (nChr <= 0x7fffffff) */ else {
          /* six bytes */
          aBytes[nIdx++] = 252 + (nChr >>> 30)
          aBytes[nIdx++] = 128 + ((nChr >>> 24) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 18) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63)
          aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63)
          aBytes[nIdx++] = 128 + (nChr & 63)
          nChrIdx++
        }
        nChrIdx++
      }

      return aBytes
    },
  },
}

// 生成发送给服务端的消息
export function generateMessage(type: MessageType, data?: MessageDataMap[MessageType]) {
  switch (type) {
    case 'resize':
      const { cols, rows } = data as any
      const msg = JSON.stringify({
        Width: cols,
        Height: rows,
      })
      return K8sExecMsgChannel.Resize + util.base64.encode(msg)
    case 'data':
      const input = data as string
      return K8sExecMsgChannel.StdIn + util.base64.encode(input)
    case 'binary':
      break
    case 'heartbeat':
      return K8sExecMsgChannel.StdIn
  }
  return ''
}

// 处理服务端消息
export function processMessageFromServer(data: string | ArrayBuffer) {
  if (typeof data === 'string') {
    const base64Msg = data.slice(1)
    const type = data.slice(0, 1)
    const msg = util.base64.decode(base64Msg).toString()
    switch (type) {
      case K8sExecMsgChannel.StdOut:
      case K8sExecMsgChannel.StdError:
        return msg
      case K8sExecMsgChannel.ServiceError:
        const reg = /exit code ([0-9]+)/
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
