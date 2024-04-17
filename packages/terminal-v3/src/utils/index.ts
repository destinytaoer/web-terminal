import Logger from 'log'

export type { IDisposable } from './Disposable'
export { Disposable, toDisposable } from './Disposable'
export * from './addListener'
export * from './detect'
export { EventEmitter } from './EventEmitter'
export type { EventHandler } from './EventEmitter'

export { createHeartbeat } from './createHeartbeat'

export const log = new Logger('WebTerminal', { shortNamespace: true })