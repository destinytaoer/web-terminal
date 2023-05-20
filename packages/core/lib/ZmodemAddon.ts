import { saveAs } from 'file-saver'
import { IDisposable, ITerminalAddon, Terminal } from 'xterm'
// @ts-ignore
import * as Zmodem from 'zmodem.js/src/zmodem_browser'
import { log } from './utils.ts'

export interface ZmodeOptions {
  onSend: () => void
  sender: (data: string | Uint8Array) => void
  writer: (data: string | Uint8Array) => void
}

export class ZmodemAddon implements ITerminalAddon {
  private disposables: IDisposable[] = []

  private terminal?: Terminal

  private sentry: Zmodem.Sentry

  private session: Zmodem.Session

  private denier?: () => void

  constructor(private options: ZmodeOptions) {}

  activate(terminal: Terminal) {
    this.terminal = terminal
    this.zmodemInit(terminal)
  }

  consume(data: ArrayBuffer) {
    try {
      this.sentry.consume(data)
    } catch (e) {
      log.error('zmodem consume error: ', e)
      this.reset()
    }
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose()
    }
    this.disposables.length = 0
  }

  private reset = () => {
    if (this.terminal) {
      this.terminal.options.disableStdin = false
      this.terminal.focus()
    }
  }

  private disableStdIn = () => {
    if (this.terminal) {
      this.terminal.options.disableStdin = true
    }
  }

  // private addDisposableListener(target: EventTarget, type: string, listener: EventListener) {
  //   target.addEventListener(type, listener)
  //   this.disposables.push({ dispose: () => target.removeEventListener(type, listener) })
  // }

  private zmodemInit = (terminal: Terminal) => {
    const { sender, writer } = this.options
    const { reset, zmodemDetect } = this
    this.session = null
    this.sentry = new Zmodem.Sentry({
      to_terminal: (octets: any) => {
        log.info('zmodem to terminal', octets)
        writer(new Uint8Array(octets))
      },
      sender: (octets: any) => {
        log.info('sender')
        sender(new Uint8Array(octets))
      },
      on_retract: () => reset(),
      on_detect: (detection: any) => zmodemDetect(detection),
    })
    this.disposables.push(
      terminal.onKey((e) => {
        const event = e.domEvent
        if (event.ctrlKey && event.key === 'c') {
          if (this.denier) this.denier()
        }
      }),
    )
  }

  private zmodemDetect = (detection: Zmodem.Detection): void => {
    const { disableStdIn, receiveFile } = this
    disableStdIn()

    this.denier = () => detection.deny()
    this.session = detection.confirm()
    this.session.on('session_end', () => this.reset())

    log.info('detection', detection)
    log.info('type', this.session.type)

    if (this.session.type === 'send') {
      this.options.onSend()
    } else {
      receiveFile()
    }
  }

  public closeSession = () => {
    this.session?._on_session_end()
  }

  public sendFile = (files: FileList) => {
    const { session, writeProgress } = this
    Zmodem.Browser.send_files(session, files, {
      on_progress: (_: any, offer: any) => writeProgress(offer),
    })
      .then(() => session.close())
      .catch(() => this.reset())
  }

  private receiveFile = () => {
    const { session, writeProgress } = this

    session.on('offer', (offer: any) => {
      offer.on('input', () => writeProgress(offer))
      offer
        .accept()
        .then((payloads: any) => {
          const blob = new Blob(payloads, { type: 'application/octet-stream' })
          saveAs(blob, offer.get_details().name)
        })
        .catch(() => this.reset())
    })

    session.start()
  }

  private writeProgress = (offer: Zmodem.Offer) => {
    const { bytesHuman } = this
    const file = offer.get_details()
    const name = file.name
    const size = file.size
    const offset = offer.get_offset()
    const percent = ((100 * offset) / size).toFixed(2)

    this.options.writer(`${name} ${percent}% ${bytesHuman(offset, 2)}/${bytesHuman(size, 2)}\r`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bytesHuman(bytes: any, precision: number): string {
    if (!/^([-+])?|(\.\d+)(\d+(\.\d+)?|(\d+\.)|Infinity)$/.test(bytes)) {
      return '-'
    }
    if (bytes === 0) return '0'
    if (typeof precision === 'undefined') precision = 1
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
    const num = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = (bytes / Math.pow(1024, Math.floor(num))).toFixed(precision)
    return `${value} ${units[num]}`
  }
}
