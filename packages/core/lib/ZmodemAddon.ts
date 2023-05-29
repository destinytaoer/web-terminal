import { IDisposable, ITerminalAddon, Terminal } from 'xterm'
import { log } from './utils'
import { Zmodem, Detection, Octets, ZmodemSendSession, ZmodemSentry, ZmodemSession } from 'zmodem'
import { TrzszFilter } from 'trzsz'

// import * as Zmodem from 'zmodem.js/src/zmodem_browser'

export interface ZmodeOptions {
  enableZmodem?: boolean
  enableTrzsz?: boolean
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

  private trzszFilter: TrzszFilter

  constructor(private options: ZmodeOptions) {}

  activate(terminal: Terminal) {
    this.terminal = terminal
    // Zmodem.setDebug(true)
    if (this.options.enableZmodem) this.zmodemInit(terminal)
    if (this.options.enableTrzsz) this.trzszInit(terminal)
  }

  closeSession() {
    this.denier?.()
  }

  consume(data: ArrayBuffer) {
    try {
      if (this.options.enableTrzsz) {
        this.trzszFilter.processServerOutput(data)
      } else {
        console.log('sentry consume data', data)
        this.sentry?.consume(data)
      }
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

  private trzszInit = (terminal: Terminal) => {
    console.log('trzsz init')
    const { sender, enableZmodem } = this.options
    this.trzszFilter = new TrzszFilter({
      writeToTerminal: (data) => {
        if (!this.trzszFilter.isTransferringFiles() && enableZmodem) {
          this.sentry.consume(data)
        } else {
          this.writeToTerminal(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer))
        }
      },
      sendToServer: (data) => sender(data),
      terminalColumns: terminal.cols,
      isWindowsShell: false,
      chooseSendFiles() {},
    })
    // TODO: 拖拽上传下载
    // const element = terminal.element as EventTarget;
    // this.addDisposableListener(element, 'dragover', event => event.preventDefault());
    // this.addDisposableListener(element, 'drop', event => {
    //   event.preventDefault();
    //   this.trzszFilter
    //       .uploadFiles((event as DragEvent).dataTransfer?.items as DataTransferItemList)
    //       .then(() => console.log('[ttyd] upload success'))
    //       .catch(err => console.log('[ttyd] upload failed: ' + err));
    // });
    this.disposables.push(terminal.onResize((size) => this.trzszFilter.setTerminalColumns(size.cols)))
    // forward the user input to TrzszFilter
    // this.disposables.push(terminal.onData((data) => this.trzszFilter.processTerminalInput(data)))
    // forward binary input to TrzszFilter
    // this.disposables.push(terminal.onBinary((data) => this.trzszFilter.processBinaryInput(data)))
  }

  private zmodemInit = (terminal: Terminal) => {
    console.log('zmodem init')
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
    // FIXME: lrzsz 上传取消可能导致卡住
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
    const fileName = files[0].name

    log.success(`upload file, size: ${fileSize}`, new Date().toLocaleString())

    try {
      let count = 0
      // 使用 send_block_files 分片上传才有进度条, 并且解决了大文件上传报错的问题
      // https://github.com/FGasper/zmodemjs/issues/11
      Zmodem.Browser.send_block_files(session as ZmodemSendSession, files, {
        on_progress: (_, offer) => {
          if (count === 0) {
            this.terminal?.write('\r\n')
            count++
          }
          const offset = offer.get_offset()
          if (offset !== fileSize) {
            writeProgress(offer)
          } else if (count === 1) {
            writeProgress(offer)
            this.terminal?.write(`\r\nmerging file ${fileName}, please wait a moment\r\n`)
            count++
          }
        },
        on_file_complete: () => {
          log.success('file complete')
        },
      })
        .then(() => {
          log.success('send file success', new Date().toLocaleString())
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
      log.success('start to download file', new Date().toLocaleString())
      offer.on('input', () => writeProgress(offer))
      offer
        .accept()
        .then((payloads: any) => {
          log.success('download success', new Date().toLocaleString())
          Zmodem.Browser.save_to_disk(payloads, offer.get_details().name)
          // this.options.sender(new Uint8Array([79, 79]))
          // setTimeout(() => {
          //   log.warn('session._has_ended', session._has_ended())
          //   session._on_session_end()
          //   this.denier()
          // })
          // FIXME: sz 下载大文件时, 可能会导致终端卡住(未知, 偶现, 跟 lrzsz 版本无关, 不一定是大文件)
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
          // setTimeout(() => {
          //   if (!session._has_ended()) {
          //     log.warn('force end session')
          //     // session._send_header('ZRINIT')
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
