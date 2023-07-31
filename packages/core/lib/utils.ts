import { IDisposable } from 'xterm'
import Logger from 'log'

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

export const log = new Logger('WebTerminal', { shortNamespace: true })
