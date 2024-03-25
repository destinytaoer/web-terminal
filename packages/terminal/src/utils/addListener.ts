import type { IDisposable } from './Disposable'

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

export function addDisposableDomListener(
  node: Element | Window | Document,
  type: string,
  handler: (e: any) => void,
  options?: boolean | AddEventListenerOptions,
): IDisposable {
  node.addEventListener(type, handler, options)
  let disposed = false
  return {
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      node.removeEventListener(type, handler, options)
    },
  }
}
