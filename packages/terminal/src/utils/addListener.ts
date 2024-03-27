import type { IDisposable } from './Disposable'
import { EventEmitter, EventHandler } from './EventEmitter'

export function addSocketListener<K extends keyof WebSocketEventMap>(
  socket: WebSocket,
  type: K,
  handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
): IDisposable {
  return addDisposableEventListener(socket, type, handler)
}

export function addDisposableEventListener(
  target: EventTarget,
  type: string,
  handler: (e: any) => void,
  options?: boolean | AddEventListenerOptions,
): IDisposable {
  target.addEventListener(type, handler, options)
  let disposed = false
  return {
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      target.removeEventListener(type, handler, options)
    },
  }
}

export function addEventEmitterListener(em: EventEmitter, eventName: string, handler: EventHandler) {
  em.addEventListener(eventName, handler)
  let disposed = false
  return {
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      em.removeListener(eventName, handler)
    },
  }
}
