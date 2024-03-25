import Logger from 'log'

export type { IDisposable } from './Disposable'
export { Disposable } from './Disposable'
export * from './addListener'
export * from './detect'

export const log = new Logger('WebTerminal', { shortNamespace: true })
