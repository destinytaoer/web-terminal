import { IDisposable, ITerminalAddon, Terminal } from 'xterm'
import { log } from './utils'
import { Zmodem, Detection, Octets, Offer, ZmodemReceiveSession, ZmodemSendSession, ZmodemSentry } from 'zmodem'

// import * as Zmodem from 'zmodem.js/src/zmodem_browser'

export interface ZmodeOptions {
  onSend: () => void
  sender: (data: string | Uint8Array) => void
}

export class ZmodemAddon implements ITerminalAddon {
  private disposables: IDisposable[] = []

  private terminal?: Terminal

  private sentry?: Zmodem.Sentry

  private session: Zmodem.Session | null = null

  private reveiveSession: Zmodem.Session | null = null

  public denier?: () => void

  constructor(private options: ZmodeOptions) {}

  activate(terminal: Terminal) {
    this.terminal = terminal
    this.zmodemInit(terminal)
  }

  closeSession() {
    console.log('close session')
    this.denier?.()
    // if (this.session && this.session.type === 'send') {
    //   this.session._last_header_name = 'ZRINIT'
    //   this.session.close?.()
    // }
  }

  consume(data: ArrayBuffer) {
    try {
      this.sentry?.consume(data)
    } catch (e) {
      log.error('zmodem consume error: ', e)
      this.closeSession()
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

  // 是否在上传中
  sending = false

  // 当前上传 byte 数
  sendingCount = 0

  private zmodemInit = (terminal: Terminal) => {
    const { sender } = this.options
    const { reset, zmodemDetect } = this

    this.sentry = new Zmodem.Sentry({
      to_terminal: (octets: any) => {
        this.writeToTerminal(new Uint8Array(octets))
      },
      sender: (octets: any) => {
        const buffer = new Uint8Array(octets)
        if (this.sending) {
          log.info('sending', buffer.byteLength)
          // console.log('buffer', Buffer.from(octets).toString('utf8'))
          this.sendingCount += buffer.byteLength
        }
        sender(buffer)
      },
      on_retract: () => reset(),
      on_detect: (detection: any) => zmodemDetect(detection),
    })
    this.disposables.push(
      terminal.onKey((e) => {
        const event = e.domEvent
        if (event.ctrlKey) log.success('on ctrl Key')
        if (event.ctrlKey && event.key === 'c') {
          log.warn('cancel')
          if (this.denier) {
            log.warn('denier')
            // 取消下载时双重 deny 才生效
            this.denier()
            this.denier()
            // this.session?.close?.()
          }
        }
      }),
    )
  }

  private zmodemDetect = (detection: any): void => {
    const { disableStdIn, receiveFile } = this
    // disableStdIn()

    this.denier = () => detection.deny()
    const session = detection.confirm()
    this.session = session
    session.on('session_end', () => {
      console.log('session closed')
      // this.sendSession = null
      // this.reveiveSession = null
      this.reset()
    })

    log.info('detection', detection)
    log.info('type', session.type)

    if (session.type === 'send') {
      this.options.onSend()
    } else {
      this.reveiveSession = session
      receiveFile()
    }
  }

  public sendFile = (files: FileList) => {
    const { session, writeProgressToTerminal } = this
    if (!session || session._aborted) return
    const fileSize = [...files].reduce((prev, file) => prev + file.size, 0)
    this.sending = true
    log.success('upload file')
    // this.writeToTerminal('正在上传文件\r')
    try {
      Zmodem.Browser.send_files(session, files, {
        // on_progress: (_: any, offer: any) => writeProgress(offer),
        // on_offer_response: (f, offer) => {
        //   console.log('offer', offer, new Date().toLocaleString())
        //   if (offer) {
        //     // offer.on('send_progress', (info) => {
        //     //   const { file, offset, total } = info
        //     //   log.success('upload percent', info, new Date().toLocaleString())
        //     //   writeProgressToTerminal(file.name, offset, total)
        //     // })
        //   }
        // },
      })
        .then(() => {
          log.success('send file success')
          session.close()
        })
        .catch((e) => {
          log.error('send file error', e)
          this.reset()
        })
        .finally(() => {
          console.log('this.sendingCount', this.sendingCount, fileSize)
          this.sending = false
          this.sendingCount = 0
        })
    } catch (e) {
      log.error('error', e)
    }
  }

  private receiveFile = () => {
    const { session, writeProgress } = this
    if (!session || session._aborted) return
    session.on('offer', (offer: any) => {
      // const size = offer._file_info.size
      // const name = offer._file_info.name
      // if (size > 200 * 1024 * 1024) {
      //   log.error('download over limit')
      //   this.denier?.()
      //   return
      // }
      offer.on('input', () => writeProgress(offer))
      offer
        .accept()
        .then((payloads: any) => {
          log.success('download success')
          Zmodem.Browser.save_to_disk(payloads, offer.get_details().name)
        })
        .catch(() => this.reset())
    })

    session.start()
  }

  private writeProgress = (offer: any) => {
    const file = offer.get_details()
    const name = file.name
    const size = file.size
    const offset = offer.get_offset()
    this.writeProgressToTerminal(name, offset, size)
  }

  private writeProgressToTerminal = (name: string, offset: number, size: number) => {
    const { bytesHuman } = this
    const percent = ((100 * offset) / size).toFixed(2)
    const message = `${name} ${percent}% ${bytesHuman(offset, 2)}/${bytesHuman(size, 2)}\r`
    this.writeToTerminal(message)
    if (Number(percent) === 100) {
      this.writeToTerminal(`正在合成文件 ${name}\r`)
    }
  }

  private writeToTerminal(data: string | Uint8Array) {
    this.terminal?.write(data)
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
