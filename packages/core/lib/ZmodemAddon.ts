import { IDisposable, ITerminalAddon, Terminal } from 'xterm'
import { log } from './utils'
import { Zmodem, Detection, Octets, ZmodemSendSession, ZmodemSentry, ZmodemSession } from 'zmodem'

// import * as Zmodem from 'zmodem.js/src/zmodem_browser'

export interface ZmodeOptions {
  onSend: () => void
  sender: (data: string | Uint8Array) => void
  onReceiveOverLimit?: (name: string, size: number) => void
  // 下载的限制 byte
  receiveLimit?: number
}

// 200M
const DefaultReceiveLimit = 200 * 1024 * 1024

export class ZmodemAddon implements ITerminalAddon {
  private disposables: IDisposable[] = []

  private terminal?: Terminal

  private sentry?: any

  private session: any | null = null

  private denier?: () => void

  constructor(private options: ZmodeOptions) {}

  activate(terminal: Terminal) {
    this.terminal = terminal
    // Zmodem.setDebug(true)
    this.zmodemInit(terminal)
  }

  closeSession() {
    this.denier?.()
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

  // private xfer?: Transfer | null

  private zmodemInit = (terminal: Terminal) => {
    const { sender } = this.options
    const { reset, zmodemDetect } = this

    this.sentry = new Zmodem.Sentry({
      to_terminal: (octets: any) => {
        const buffer = new Uint8Array(octets)
        this.writeToTerminal(buffer)
      },
      sender: (octets: any) => {
        const buffer = new Uint8Array(octets)
        // const xfer = this.xfer
        // if (xfer) {
        //   this.writeProgress(xfer)
        // }
        sender(buffer)
      },
      on_retract: () => reset(),
      on_detect: (detection: any) => zmodemDetect(detection),
    })
    // TODO: 取消功能
    // FIXME: 上传取消可能导致卡住
    // this.disposables.push(
    //   terminal.onKey((e) => {
    //     const event = e.domEvent
    //     if (event.ctrlKey && event.key === 'c') {
    //       log.warn('cancel')
    //       if (this.denier) {
    //         log.warn('denier')
    //         // 取消下载时双重 deny 才生效
    //         // this.denier()
    //         //   this.denier()
    //         // if (this.xfer) {
    //         //   console.log('skip')
    //         // }
    //       }
    //     }
    //   }),
    // )
  }

  private zmodemDetect = (detection: any): void => {
    const { disableStdIn, receiveFile } = this

    // 禁止输入
    disableStdIn()

    this.denier = () => detection.deny()

    const session = detection.confirm()
    this.session = session
    session.on('session_end', () => {
      log.success('session end')
      this.reset()
    })

    if (session.type === 'send') {
      this.options.onSend()
    } else {
      receiveFile()
    }
  }

  public sendFile = (files: FileList) => {
    const { session, writeProgress, writeProgressToTerminal } = this
    if (!session || session.aborted()) return
    const fileSize = [...files].reduce((prev, file) => prev + file.size, 0)

    log.success(`upload file, size: ${fileSize}`)

    try {
      // 使用 send_block_files 分片上传才有进度条, 并且解决了大文件上传报错的问题
      // https://github.com/FGasper/zmodemjs/issues/11
      Zmodem.Browser.send_block_files(session, files, {
        on_progress: (file, offer) => writeProgress(offer),
        on_offer_response: (file, xfer) => {
          log.success('on_offer_response', xfer)
          if (xfer) {
            // 准备上传
            // this.xfer = xfer
            // xfer.on('send_progress', (info) => {
            //   const { file, offset, total } = info
            //   log.info('upload percent', info, new Date().toLocaleString())
            //   writeProgressToTerminal(file.name, offset, total)
            // })
          } else {
            // 已经上传过了, 不再继续上传
            this.writeToTerminal(file.name + ' has already been uploaded\r\n')
          }
        },
        on_file_complete: () => {
          log.success('file complete')
        },
      })
        .then(() => {
          log.success('send file success')
          session.close()
        })
        .catch((e: any) => {
          log.error('send file error', e)
          this.reset()
        })
    } catch (e) {
      log.error('error', e)
    }
  }

  private receiveFile = () => {
    const { session, writeProgress } = this
    const { receiveLimit = DefaultReceiveLimit, onReceiveOverLimit } = this.options
    if (!session || session.aborted()) return
    session.on('offer', (offer) => {
      // const size = offer._file_info.size
      // const name = offer._file_info.name
      // if (size > receiveLimit) {
      //   log.error('download over limit')
      //   onReceiveOverLimit?.(name, size)
      //   // skip 后会显示 sz skip xxx, 并且换行有问题
      //   // offer.skip()
      //   this.denier?.()
      //   return
      // }
      offer.on('input', () => writeProgress(offer))
      offer
        .accept()
        .then((payloads: any) => {
          log.success('download success')
          Zmodem.Browser.save_to_disk(payloads, offer.get_details().name)
          // this.options.sender(new Uint8Array([79, 79]))
          // setTimeout(() => {
          //   log.warn('session._has_ended', session._has_ended())
          //   session._on_session_end()
          //   this.denier()
          // })
          // FIXME: sz 下载大文件时, 可能会导致终端卡住
          // https://github.com/FGasper/zmodemjs/issues/33
          // setTimeout(() => {
          //   if (!session._has_ended()) {
          //     console.log('force end session')
          //     this.options.sender(new Uint8Array([79, 79]))
          //     // session.abort()
          //     // session._on_session_end()
          //     // session._bytes_after_OO = undefined
          //     // offer.skip()
          //     this.denier()
          //   }
          // }, 200)
          this.reset()
        })
        .catch((e) => {
          console.log('accept error', e)
          this.reset()
        })
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

    // if (Number(percent) === 100) {
    //   log.success('is concat file')
    //   // this.writeToTerminal(`正在合成文件 ${name}\r`)
    //   // 会被打印三次
    //   // TODO: 如何处理上传或者下载完成后的合并文件时间
    // }
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
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const num = Math.floor(Math.log(bytes) / Math.log(1024))
    const unit = units[num]
    const value = (bytes / Math.pow(1024, num)).toFixed(precision)
    return `${value} ${units[num]}`
  }
}
