import { IDisposable } from 'xterm'

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
    if (type === 'error') console.error(`[${this.scope}]`, ...args)
    if (type === 'warn') console.warn(`[${this.scope}]`, ...args)
    if (type === 'success') console.log(`[${this.scope}]`, ...args)
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

export const log = new Logger('WebTerminal', 'dev')
