import ms from './ms'

type LogType = 'info' | 'success' | 'error' | 'warn'

function toNamespace(regexp: RegExp) {
  return regexp
    .toString()
    .substring(2, regexp.toString().length - 2)
    .replace(/\.\*\?$/, '*')
}

interface LogOptions {
  shortNamespace?: boolean
}

const LogLevel = {
  info: 0,
  success: 1,
  warn: 2,
  error: 3,
} as const

export default class Logger {
  // log Level info-0 success-1 warn-2 error-3
  static logLevel = 0

  static namespaces = ''

  static names: RegExp[] = []

  static skips: RegExp[] = []

  static enable(namespaces?: string) {
    Logger.names = []
    Logger.skips = []
    let i
    const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/)
    const len = split.length

    for (i = 0; i < len; i++) {
      if (!split[i]) {
        // ignore empty strings
        continue
      }

      namespaces = split[i].replace(/\*/g, '.*?')

      if (namespaces[0] === '-') {
        Logger.skips.push(new RegExp('^' + namespaces.slice(1) + '$'))
      } else {
        Logger.names.push(new RegExp('^' + namespaces + '$'))
      }
    }
  }

  static disable() {
    const namespaces = [...Logger.names.map(toNamespace), ...Logger.skips.map(toNamespace).map((namespace) => '-' + namespace)].join(',')
    Logger.enable('')
    return namespaces
  }

  static enabled(name: string) {
    if (name[name.length - 1] === '*') {
      return true
    }

    let i
    let len

    for (i = 0, len = Logger.skips.length; i < len; i++) {
      if (Logger.skips[i].test(name)) {
        return false
      }
    }

    for (i = 0, len = Logger.names.length; i < len; i++) {
      if (Logger.names[i].test(name)) {
        return true
      }
    }

    return false
  }

  static namespaceSeparator = ':'

  constructor(private namespace: string, private options?: LogOptions) {}

  prev = 0

  cur = 0

  diff = 0

  colorMap: Record<LogType, { bg: string; text: string }> = {
    info: {
      bg: '#0099FF',
      text: '#fff',
    },
    success: {
      bg: '#33C14B',
      text: '#fff',
    },
    error: {
      bg: 'red',
      text: '#fff',
    },
    warn: {
      bg: '#F97C12',
      text: '#fff',
    },
  }

  private logFn = console.debug || console.log

  get enabled() {
    return Logger.enabled(this.namespace)
  }

  private log(type: LogType, ...args: any[]) {
    if (Logger.logLevel > LogLevel[type]) return
    if (!this.enabled) {
      if (type === 'success') console.log(args[0] + ': ', ...args.slice(1))
      if (type === 'warn') console.warn(args[0] + ': ', ...args.slice(1))
      if (type === 'error') console.error(args[0] + ': ', ...args.slice(1))
      return
    }
    const curr = Number(new Date())
    this.diff = curr - (this.cur || curr)
    this.prev = this.cur
    this.cur = curr

    const formatDiff = ms(this.diff)

    const color = this.colorMap[type]
    const namespaceArray = this.namespace.split(Logger.namespaceSeparator)
    const namespace = this.options?.shortNamespace ? namespaceArray.slice(-1)[0] : this.namespace

    this.logFn(
      `%c ${namespace} %c ${type.toUpperCase()} %c ${args[0]} %c ${formatDiff}`,
      `background: #35495E; padding: 2px; border-radius: 2px 0 0 2px;color: #fff;`,
      `background: ${color.bg}; padding: 2px; border-radius: 0 2px 2px 0;color: ${color.text};`,
      `color: inherit;`,
      `color: ${color.bg};`,
      ...args.slice(1),
    )
  }

  extend(namespace: string, options?: LogOptions) {
    return new Logger(`${this.namespace}${Logger.namespaceSeparator}${namespace}`, options)
  }

  info(...args: any[]) {
    this.log('info', ...args)
  }

  success(...args: any[]) {
    this.log('success', ...args)
  }

  error(...args: any[]) {
    this.log('error', ...args)
  }

  warn(...args: any[]) {
    this.log('warn', ...args)
  }

  group(label: string) {
    if (!this.enabled) return

    if (console.groupCollapsed) {
      console.groupCollapsed(label)
    } else {
      console.group(label)
    }
  }

  groupEnd() {
    if (!this.enabled) return
    console.groupEnd()
  }
}
