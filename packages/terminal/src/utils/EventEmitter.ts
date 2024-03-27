type Listener = {
  fn: EventHandler
  once: boolean
}

export type EventHandler = (...args: any) => void

export class EventEmitter {
  private _events: Record<string, Listener[]>

  constructor() {
    this._events = {}
  }

  on(eventName: string, fn: EventHandler, once: boolean = false) {
    this._events[eventName] = this._events[eventName] || []

    this._events[eventName].push({ fn, once })

    return () => {
      this.off(eventName, fn)
    }
  }

  once(eventName: string, fn: EventHandler) {
    this.on(eventName, fn, true)
  }

  off(eventName: string, fn?: EventHandler) {
    if (!fn) {
      this._events[eventName] = []
    } else {
      this._events[eventName] = this._events[eventName]?.filter((listener) => fn !== listener.fn)
    }
  }

  emit(eventName: string, ...args: any[]) {
    const listeners = this._events[eventName]
    if (listeners) {
      listeners.forEach((listener) => {
        listener.fn.call(null, ...args)
        if (listener.once) this.off(eventName, listener.fn)
      })
    }
  }

  clear() {
    this._events = {}
  }

  listenerCount(eventName: string) {
    return this._events[eventName]?.length || 0
  }

  rawListeners(eventName: string) {
    return this._events[eventName] || []
  }

  addEventListener(eventName: string, fn: EventHandler) {
    this.on(eventName, fn)
  }

  removeListener(eventName: string, fn: EventHandler) {
    this.off(eventName, fn)
  }

  removeAllListeners(eventName: string) {
    this.off(eventName)
  }
}
