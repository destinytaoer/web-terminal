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

export class Logger {
  colorMap = {
    info: {
      bg: '#0099FF',
      color: '#fff',
    },
    success: {
      bg: '#33C14B',
      color: '#fff',
    },
    error: {
      bg: 'red',
      color: '#fff',
    },
    warn: {
      bg: '#F97C12',
      color: '#fff',
    },
  }

  constructor(private scope: string, private env: 'prod' | 'dev' = 'prod') {}

  private log(type: 'info' | 'success' | 'error' | 'warn', ...args: any[]) {
    if (this.env === 'prod') return
    console.debug(
      `%c ${this.scope} %c ${type.toUpperCase()} `,
      `background:#35495E; padding: 2px; border-radius: 2px 0 0 2px;color: #fff;`,
      `background:${this.colorMap[type].bg}; padding: 2px; border-radius: 0 2px 2px 0;color: ${this.colorMap[type].color};`,
      ...args,
    )
  }

  info(title: string, ...args: any[]) {
    this.log('info', title, ...args)
  }

  success(title: string, ...args: any[]) {
    this.log('success', title, ...args)
  }

  error(title: string, ...args: any[]) {
    this.log('error', title, ...args)
  }

  warn(title: string, ...args: any[]) {
    this.log('warn', title, ...args)
  }
}
