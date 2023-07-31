import { Detection, TrzszOptions } from 'trzsz'
import { TrzszFilter } from 'trzsz'
import { Terminal, IDisposable, ITerminalAddon } from 'xterm'
import { addSocketListener } from './utils'

export type MessageType = 'data' | 'binary' | 'resize' | 'heartbeat'

export type MessageData =
  | { type: 'data'; content: string }
  | { type: 'binary'; content: string }
  | {
      type: 'heartbeat'
      content?: any
    }
  | {
      type: 'resize'
      content: {
        cols: number
        rows: number
      }
    }
  | { type: string; content: any }

export type ProcessMessageToServerFn = (data: MessageData) => string | ArrayBufferLike | Blob | ArrayBufferView | undefined

export type ProcessMessageFromServerFn = (data: ArrayBuffer | string) => string | Uint8Array | undefined

export interface TrzszAddonOptions extends Pick<TrzszOptions, 'chooseSendFiles' | 'chooseSaveDirectory' | 'isWindowsShell'> {
  processMessageToServer?: ProcessMessageToServerFn
  processMessageFromServer?: ProcessMessageFromServerFn
}

const MAX_DOWNLOAD_FILE_SIZE = 200 * 1024 * 1024
const MAX_UPLOAD_FILE_SIZE = 200 * 1024 * 1024
const MAX_UPLOAD_BUFFER_SIZE = 45 * 1024

/**
 * An addon for xterm.js that supports trzsz
 */
export class TrzszAddon extends WebSocket implements ITerminalAddon {
  private _disposables: IDisposable[] = []

  private options: TrzszAddonOptions

  private trzsz: TrzszFilter | null = null

  private processMessageToServer: ProcessMessageToServerFn = (data: MessageData) => {
    const { type, content } = data

    switch (type) {
      case 'data':
        return content
      case 'binary':
        const buffer = new Uint8Array(content.length)
        for (let i = 0; i < content.length; ++i) {
          buffer[i] = content.charCodeAt(i) & 255
        }
        return buffer
      default:
        return
    }
  }

  private processMessageFromServer: ProcessMessageFromServerFn = (data: ArrayBuffer | string) => {
    try {
      if (typeof data === 'string') {
        const obj = JSON.parse(data)
        if (obj.type === 'heartbeat') {
          return
        }
      }
    } catch (e) {}
    return typeof data === 'string' ? data : new Uint8Array(data)
  }

  /**
   * Create a TrzszAddon
   * @param {url} string - The websocket connection url.
   * @param {TrzszOptions} options - The trzsz options.
   */
  constructor(url: string, protocols: string | string[], options?: TrzszAddonOptions) {
    super(url, protocols)

    // always set binary type to arraybuffer, we do not handle blobs
    this.binaryType = 'arraybuffer'
    this.options = options || {}

    this.processMessageToServer = options?.processMessageToServer ?? this.processMessageToServer
    this.processMessageFromServer = options?.processMessageFromServer ?? this.processMessageFromServer
  }

  sendMessage<T extends MessageType>(type: T, data?: any) {
    if (this._checkOpenSocket()) {
      const message = this.processMessageToServer({ type, content: data })
      if (message) {
        this.send(message)
      }
    }
  }

  /**
   * Upload files or directories to the server.
   * @param {string[] | DataTransferItemList} items - The files or directories to upload.
   */
  async uploadFiles(items: string[] | DataTransferItemList) {
    if (this.trzsz) {
      return this.trzsz.uploadFiles(items)
    } else {
      throw new Error('Addon has not been activated')
    }
  }

  /**
   * Activate TrzszAddon
   * @param {Terminal} terminal - The xterm.js terminal
   */
  public activate(terminal: Terminal): void {
    const writeToTerminal = (data) => {
      terminal.write(typeof data === 'string' ? data : new Uint8Array(data))
    }
    const sendToServer = (data) => {
      this.sendMessage('data', data)
    }

    this.trzsz = new TrzszFilter({
      writeToTerminal,
      sendToServer,
      chooseSendFiles: this.options.chooseSendFiles,
      chooseSaveDirectory: this.options.chooseSaveDirectory,
      terminalColumns: terminal.cols,
      isWindowsShell: this.options.isWindowsShell,
      onDetect: this.onDetect,
    })

    this.attachSocket(this)
    this.attachTerminal(terminal)
  }

  private onDetect = async (detection: Detection) => {
    const { mode } = detection

    if (mode === 'S') {
      // 下载文件
      await this.handleDownloadFiles(detection)
    } else if (mode === 'R') {
      // 上传文件
      await this.handleUploadFiles(detection)
    } else if (mode === 'D') {
      // TODO: 暂不支持上传目录提示
      this.trzsz.throwError('暂不支持上传目录')
      // 取消上传
      // await this.trzsz.cancelTransfer(remoteIsWindows)
      // 上传目录
      // await this.trzsz.handleTrzszUploadFiles(version, true, remoteIsWindows)
    }
  }

  private async handleUploadFiles(detection: Detection) {
    const { mode, version, remoteIsWindows } = detection
    const files = await this.selectFile()
    const file = files?.item(0)

    // 未选择文件
    if (!file) {
      console.log('cancel file upload')
      this.trzsz.cancelTransfer(remoteIsWindows)
      return
    }

    // 文件大小限制
    const fileSize = file.size
    const num = files.length
    const filename = file.name
    if (fileSize > MAX_UPLOAD_FILE_SIZE) {
      // TODO: 提示用户超过预定文件大小了
      // message.warn('限制上传 200MB 以内的文件')
      this.trzsz.throwError('暂不支持上传大于 200M 的文件')
    }

    const transfer = await this.trzsz.acceptTransfer(remoteIsWindows)

    // 接收文件配置
    const config = await transfer.recvConfig()

    if (config.bufsize && config.bufsize > MAX_UPLOAD_BUFFER_SIZE) {
      console.warn('trz bufSize 配置大于 45k, 现进行限流 45k')
    }

    if (config.quiet !== true) {
      // 初始化 progress
      this.trzsz?.initProgressBar(config.tmux_pane_width)
      this.trzsz?.updateProgressBar('onNum', num)
      this.trzsz?.updateProgressBar('onName', filename)
      this.trzsz?.updateProgressBar('onSize', fileSize)
    }

    // 发送文件数量
    await transfer.sendFileNumPure(num)
    // 发送文件名称
    const remoteFilename = await transfer.sendFileNamePure(filename)
    // 发送文件大小
    await transfer.sendFileSizePure(fileSize)

    // 上传文件
    const md5 = await transfer.sendFileDataPure(file, (step) => this.trzsz?.updateProgressBar('onStep', step), MAX_UPLOAD_BUFFER_SIZE)

    // 验证 md5
    await transfer.sendFileMD5Pure(md5)
    this.trzsz?.updateProgressBar('onDone')

    // 发送退出
    await transfer.clientExit(`Received ${remoteFilename}`)
  }

  selectFile(multiple = false): Promise<FileList | null> {
    return new Promise((resolve, reject) => {
      const inputDom = document.createElement('input')
      inputDom.type = 'file'
      inputDom.multiple = multiple
      inputDom.addEventListener('change', (e: any) => {
        const files = e.target?.files
        console.log('files', files)
        resolve(files)
      })

      inputDom.addEventListener('cancel', () => {
        resolve(null)
      })

      inputDom.click()
    })
  }

  private async handleDownloadFiles(detection: Detection) {
    const { version, remoteIsWindows } = detection
    const transfer = await this.trzsz.acceptTransfer(remoteIsWindows)

    // 接收文件配置
    const config = await transfer.recvConfig()
    if (config.directory) {
      // TODO: 暂不支持下载目录提示
      this.trzsz.throwError('暂不支持下载目录')
    }

    // 接收文件数量
    const num = await transfer.recvFileNumPure()
    if (num > 1) {
      // TODO: 暂不支持下载多个文件提示
      this.trzsz?.throwError('暂不支持下载多个文件')
    }

    // 接收文件名和文件大小
    const filename = await transfer.recvFileNamePure()
    const fileSize = await transfer.recvFileSizePure()

    if (config.quiet !== true) {
      // 初始化 progress
      this.trzsz?.initProgressBar(config.tmux_pane_width)
      this.trzsz?.updateProgressBar('onNum', num)
      this.trzsz?.updateProgressBar('onName', filename)
      this.trzsz?.updateProgressBar('onSize', fileSize)
    }

    if (fileSize > MAX_DOWNLOAD_FILE_SIZE) {
      this.trzsz?.throwError('暂不支持下载大于 200M 的文件')
    }

    // 接收文件
    const { buffer, md5 } = await transfer.recvFileDataPure(fileSize, (step) => this.trzsz?.updateProgressBar('onStep', step))

    // 验证 md5
    await transfer.recvFileMD5Pure(md5)
    this.trzsz?.updateProgressBar('onDone')

    // 发送退出
    await transfer.clientExit(`Saved ${filename}`)

    // 保存文件
    this.save_to_disk(buffer, filename)
  }

  save_to_disk(buf: Uint8Array, name: string) {
    var blob = new Blob([buf.buffer])
    var url = URL.createObjectURL(blob)

    var el = document.createElement('a')
    el.style.display = 'none'
    el.href = url
    el.download = name
    document.body.appendChild(el)

    //It seems like a security problem that this actually works;
    //I’d think there would need to be some confirmation before
    //a browser could save arbitrarily many bytes onto the disk.
    //But, hey.
    el.click()

    document.body.removeChild(el)
  }

  private attachSocket(socket: WebSocket) {
    // 建立连接后获取焦点
    // this._disposables.push(addSocketListener(socket, 'open', () => this.terminal?.focus()))
    this._disposables.push(addSocketListener(socket, 'message', (ev) => this.onMessage(ev.data)))
    this._disposables.push(addSocketListener(socket, 'close', () => this.dispose()))
    this._disposables.push(addSocketListener(socket, 'error', () => this.dispose()))
  }

  private attachTerminal(terminal: Terminal) {
    this._disposables.push(terminal.onData((data) => this.trzsz.processTerminalInput(data)))
    this._disposables.push(terminal.onBinary((data) => this.trzsz.processBinaryInput(data)))
    this._disposables.push(
      terminal.onResize((data) => {
        this.trzsz.setTerminalColumns(data.cols)
        this.sendMessage('resize', data)
      }),
    )
  }

  private consume(data: string | ArrayBuffer) {
    this.trzsz.processServerOutput(data)
  }

  private onMessage(data: string | ArrayBuffer) {
    const message = this.processMessageFromServer(data)
    if (message) {
      this.consume(message)
    }
  }

  /**
   * Dispose TrzszAddon
   */
  dispose(): void {
    for (const d of this._disposables) {
      d.dispose()
    }
    this.trzsz = null
  }

  private _checkOpenSocket(): boolean {
    switch (this?.readyState) {
      case WebSocket.OPEN:
        return true
      case WebSocket.CONNECTING:
        console.error('Attach addon was loaded before socket was open')
        break
      case WebSocket.CLOSING:
        console.warn('Attach addon socket is closing')
        break
      case WebSocket.CLOSED:
        console.error('Attach addon socket is closed')
        break
      default:
        console.error('Unexpected socket state')
    }
    return false
  }
}
