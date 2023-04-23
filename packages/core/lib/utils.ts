import { IDisposable } from 'xterm'
// import { Buffer } from 'buffer/'

export function addSocketListener<K extends keyof WebSocketEventMap>(
  socket: WebSocket,
  type: K,
  handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
): IDisposable {
  socket.addEventListener(type, handler)
  return {
    dispose: () => {
      if (!handler) {
        // Already disposed
        return
      }
      socket.removeEventListener(type, handler)
    },
  }
}

// https://github.com/aws/aws-sdk-js/blob/master/lib/util.js
// export const util = {
//   base64: {
//     encode: function encode64(string: string) {
//       if (typeof string === 'number') {
//         throw new Error('Cannot base64 encode number ' + string)
//       }
//       if (string === null || typeof string === 'undefined') {
//         return string
//       }
//       const buf = util.buffer.toBuffer(string)
//       return buf.toString('base64')
//     },
//
//     decode: function decode64(string: string) {
//       if (typeof string === 'number') {
//         throw new Error('Cannot base64 decode number ' + string)
//       }
//       if (string === null || typeof string === 'undefined') {
//         return string
//       }
//       return util.buffer.toBuffer(string, 'base64')
//     },
//   },
//   buffer: {
//     /**
//      * Buffer constructor for Node buffer and buffer pollyfill
//      */
//     toBuffer: function (data: any, encoding?: string) {
//       return typeof Buffer.from === 'function' && Buffer.from !== Uint8Array.from
//         ? Buffer.from(data, encoding)
//         : new Buffer(data, encoding)
//     },
//   },
// }

// https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa
export function utf8_to_b64(str: string) {
  return window.btoa(window.unescape(encodeURIComponent(str)))
}

export function b64_to_utf8(str: string) {
  return decodeURIComponent(window.escape(window.atob(str)))
}

export function detectWebGLContext() {
  // Create canvas element. The canvas is not added to the
  // document itself, so it is never displayed in the
  // browser window.
  const canvas = document.createElement('canvas')
  // Get WebGLRenderingContext from canvas element.
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  // Report the result.
  return Boolean(gl && gl instanceof WebGLRenderingContext)
}
