import * as browser from './browser'
import { TrzszError } from './comm'
import { Detection, TrzszConfig, TrzszOptions } from './options'
import { TrzszTransfer } from './transfer'
import { TextProgressBar } from './progress'
import { parseDataTransferItemList } from './drag'
import { strToUint8, uint8ToStr, checkDuplicateNames, stripServerOutput, TrzszFileReader } from './comm'

/**
 * trzsz magic key
 */
const trzszMagicKeyPrefix = '::TRZSZ:TRANSFER:'
const trzszMagicKeyRegExp = new RegExp(/::TRZSZ:TRANSFER:([SRD]):(\d+\.\d+\.\d+)(:\d+)?/)
const trzszMagicArray = new Float64Array(strToUint8(trzszMagicKeyPrefix).buffer, 0, 2)

/**
 * Find the trzsz magic key from output buffer.
 * @param {string | ArrayBuffer | Uint8Array | Blob} output - The output buffer.
 */
export async function findTrzszMagicKey(output: string | ArrayBuffer | Uint8Array | Blob) {
  if (typeof output === 'string') {
    const idx = output.lastIndexOf(trzszMagicKeyPrefix)
    return idx < 0 ? null : output.substring(idx)
  }
  let uint8: Uint8Array
  if (output instanceof ArrayBuffer) {
    uint8 = new Uint8Array(output)
  } else if (output instanceof Uint8Array) {
    uint8 = output
  } else if (output instanceof Blob) {
    uint8 = new Uint8Array(await output.arrayBuffer())
  } else {
    return null
  }
  if (uint8.length < 26) {
    return null
  }

  let idx = -1
  let found = -1
  while (true) {
    idx = uint8.indexOf(0x3a, idx + 1) // the index of next `:`
    if (idx < 0 || uint8.length - idx < 26) {
      if (found >= 0) {
        return uint8ToStr(uint8.subarray(found))
      }
      return null
    }
    const arr = new Float64Array(uint8.buffer.slice(uint8.byteOffset + idx, uint8.byteOffset + idx + 16))
    if (arr[0] == trzszMagicArray[0] && arr[1] == trzszMagicArray[1]) {
      found = idx
      idx += 25 // try to find next one
    }
  }
}

/**
 * Trzsz filter the input and output to upload and download files.
 */
export class TrzszFilter {
  private writeToTerminal: (output: string | ArrayBuffer | Uint8Array | Blob) => void
  private sendToServer: (input: string | Uint8Array) => void
  private chooseSendFiles?: (directory?: boolean) => Promise<string[] | undefined>
  private chooseSaveDirectory?: () => Promise<string | undefined>
  private onDetect?: (detection: Detection) => Promise<void>
  private terminalColumns: number
  private isWindowsShell: boolean
  public trzszTransfer: TrzszTransfer | null = null
  public textProgressBar: TextProgressBar | null = null
  private uniqueIdMaps: Map<string, number> = new Map<string, number>()
  private uploadFilesList: TrzszFileReader[] | null = null
  private uploadFilesResolve: Function | null = null
  private uploadFilesReject: Function | null = null
  private uploadInterrupting: boolean = false
  private uploadSkipTrzCommand: boolean = false

  /**
   * Create a trzsz filter to upload and download files.
   * @param {TrzszOptions} options - The trzsz options.
   */
  public constructor(options: TrzszOptions) {
    if (!options) {
      throw new TrzszError('TrzszOptions is required')
    }

    if (!options.writeToTerminal) {
      throw new TrzszError('TrzszOptions.writeToTerminal is required')
    }
    this.writeToTerminal = options.writeToTerminal

    if (!options.sendToServer) {
      throw new TrzszError('TrzszOptions.sendToServer is required')
    }
    this.sendToServer = options.sendToServer

    this.chooseSendFiles = options.chooseSendFiles
    this.chooseSaveDirectory = options.chooseSaveDirectory
    this.onDetect = options.onDetect
    this.terminalColumns = options.terminalColumns || 80
    this.isWindowsShell = !!options.isWindowsShell
  }

  /**
   * Process the server output.
   * @param {string} output - The server output.
   */
  public processServerOutput(output: string | ArrayBuffer | Uint8Array | Blob): void {
    if (this.isTransferringFiles()) {
      this.trzszTransfer.addReceivedData(output)
      return
    }

    if (this.uploadInterrupting) {
      return
    }
    if (this.uploadSkipTrzCommand) {
      this.uploadSkipTrzCommand = false
      const out = stripServerOutput(output)
      if (out === 'trz' || out === 'trz -d') {
        this.writeToTerminal('\r\n')
        return
      }
    }

    setTimeout(() => this.detectAndHandleTrzsz(output), 10)
    this.writeToTerminal(output)
  }

  /**
   * Process the terminal input (aka: user input).
   * @param {string} input - The terminal input (aka: user input).
   */
  public processTerminalInput(input: string): void {
    if (this.isTransferringFiles()) {
      if (input === '\x03') {
        console.log('transferring: terminal input ctrl + c to stop frontend')
        // `ctrl + c` to stop transferring files
        this.stopTransferringFiles()
      }
      return // ignore input while transferring files
    }
    if (input === '\x03') {
      console.log('terminal input ctrl + c to stop backend')
    }
    this.sendToServer(input)
  }

  /**
   * Process the terminal binary input (aka: mouse events).
   * @param {string} input - The terminal binary input (aka: mouse events).
   */
  public processBinaryInput(input: string): void {
    if (this.isTransferringFiles()) {
      return // ignore input while transferring files
    }
    this.sendToServer(strToUint8(input))
  }

  /**
   * Reset the terminal columns on resizing.
   * @param {number} columns - The columns of terminal.
   */
  public setTerminalColumns(columns: number): void {
    this.terminalColumns = columns
    if (this.textProgressBar != null) {
      this.textProgressBar.setTerminalColumns(columns)
    }
  }

  /**
   * @return {boolean} Is transferring files or not.
   */
  public isTransferringFiles(): boolean {
    return this.trzszTransfer != null
  }

  /**
   * Stop transferring files.
   */
  public stopTransferringFiles(): void {
    if (!this.isTransferringFiles()) {
      return
    }
    void this.trzszTransfer.stopTransferring()
  }

  /**
   * Upload files or directories to the server.
   * @param {string[] | DataTransferItemList} items - The files or directories to upload.
   */
  public async uploadFiles(items: string[] | DataTransferItemList) {
    if (this.uploadFilesList || this.isTransferringFiles()) {
      throw new Error('The previous upload has not been completed yet')
    }
    if (items instanceof DataTransferItemList) {
      this.uploadFilesList = await parseDataTransferItemList(items as DataTransferItemList)
    } else {
      throw new Error('The upload items type is not supported')
    }

    if (!this.uploadFilesList || !this.uploadFilesList.length) {
      this.uploadFilesList = null
      throw new Error('No files to upload')
    }

    let hasDir = false
    for (const file of this.uploadFilesList) {
      if (file.isDir() || file.getRelPath().length > 1) {
        hasDir = true
        break
      }
    }

    this.uploadInterrupting = true
    this.sendToServer('\x03')
    await new Promise((resolve) => setTimeout(resolve, 200))
    this.uploadInterrupting = false

    this.uploadSkipTrzCommand = true
    this.sendToServer(hasDir ? 'trz -d\r' : 'trz\r')

    // cleanup if it's not uploading
    setTimeout(() => {
      if (this.uploadFilesList) {
        this.uploadFilesList = null
        this.uploadFilesResolve = null
        if (this.uploadFilesReject) {
          this.uploadFilesReject('Upload does not start')
          this.uploadFilesReject = null
        }
      }
    }, 1000)

    return new Promise((resolve, reject) => {
      this.uploadFilesResolve = resolve
      this.uploadFilesReject = reject
    })
  }

  // disable jsdoc for private method
  /* eslint-disable require-jsdoc */

  private uniqueIdExists(uniqueId: string) {
    if (uniqueId.length < 8) {
      return false
    }
    if (!this.isWindowsShell && uniqueId.length == 14 && uniqueId.endsWith('00')) {
      return false
    }
    if (this.uniqueIdMaps.has(uniqueId)) {
      return true
    }
    if (this.uniqueIdMaps.size >= 100) {
      const m = new Map<string, number>()
      for (const [key, value] of this.uniqueIdMaps) {
        if (value >= 50) {
          m.set(key, value - 50)
        }
      }
      this.uniqueIdMaps = m
    }
    this.uniqueIdMaps.set(uniqueId, this.uniqueIdMaps.size)
    return false
  }

  private async detectAndHandleTrzsz(output: string | ArrayBuffer | Uint8Array | Blob) {
    const buffer = await findTrzszMagicKey(output)
    if (!buffer) {
      return
    }

    const found = buffer.match(trzszMagicKeyRegExp)
    if (!found) {
      return
    }

    const uniqueId = found.length > 3 ? found[3] : ''
    if (this.uniqueIdExists(uniqueId)) {
      return
    }

    const mode = found[1]
    const version = found[2]
    let remoteIsWindows = false
    if (uniqueId == ':1' || (uniqueId.length == 14 && uniqueId.endsWith('10'))) {
      remoteIsWindows = true
    }

    const detection = {
      mode,
      version,
      uniqueId,
      remoteIsWindows,
    } as Detection

    try {
      this.trzszTransfer = new TrzszTransfer(this.sendToServer, this.isWindowsShell)
      if (this.onDetect) {
        await this.onDetect(detection)
      } else {
        if (mode === 'S') {
          await this.handleTrzszDownloadFiles(version, remoteIsWindows)
        } else if (mode === 'R') {
          await this.handleTrzszUploadFiles(version, false, remoteIsWindows)
        } else if (mode === 'D') {
          await this.handleTrzszUploadFiles(version, true, remoteIsWindows)
        }
      }

      if (this.uploadFilesResolve) {
        this.uploadFilesResolve()
      }
    } catch (err) {
      await this.trzszTransfer.clientError(err)
      if (this.uploadFilesReject) {
        this.uploadFilesReject(err)
      }
    } finally {
      this.uploadFilesResolve = null
      this.uploadFilesReject = null
      this.trzszTransfer.cleanup()
      this.textProgressBar = null
      this.trzszTransfer = null
    }
  }

  public async handleTrzszDownloadFiles(version: string, remoteIsWindows: boolean) {
    let savePath
    let saveParam
    let openSaveFile
    const saveDirHandle = await browser.selectSaveDirectory()
    if (!saveDirHandle) {
      await this.trzszTransfer.sendAction(false, remoteIsWindows)
      return
    }
    savePath = saveDirHandle.name
    saveParam = { handle: saveDirHandle, maps: new Map<string, string>() }
    openSaveFile = browser.openSaveFile

    await this.trzszTransfer.sendAction(true, remoteIsWindows)
    const config = await this.trzszTransfer.recvConfig()

    if (config.quiet !== true) {
      this.textProgressBar = new TextProgressBar(this.writeToTerminal, this.terminalColumns, config.tmux_pane_width)
    }

    const localNames = await this.trzszTransfer.recvFiles(saveParam, openSaveFile, this.textProgressBar)

    await this.trzszTransfer.clientExit(`Saved ${localNames.join(', ')} to ${savePath}`)
  }

  public async handleTrzszUploadFiles(version: string, directory: boolean, remoteIsWindows: boolean) {
    let sendFiles
    if (this.uploadFilesList) {
      sendFiles = this.uploadFilesList
      this.uploadFilesList = null
    } else {
      sendFiles = directory ? await browser.selectSendDirectories() : await browser.selectSendFiles()
    }

    if (!sendFiles || !sendFiles.length) {
      await this.trzszTransfer.sendAction(false, remoteIsWindows)
      return
    }

    await this.trzszTransfer.sendAction(true, remoteIsWindows)
    const config = await this.trzszTransfer.recvConfig()

    if (config.overwrite === true) {
      checkDuplicateNames(sendFiles)
    }

    if (config.quiet !== true) {
      this.textProgressBar = new TextProgressBar(this.writeToTerminal, this.terminalColumns, config.tmux_pane_width)
    }

    const remoteNames = await this.trzszTransfer.sendFiles(sendFiles, this.textProgressBar)

    await this.trzszTransfer.clientExit(`Received ${remoteNames.join(', ')}`)
  }

  // 拒绝文件
  public async cancelTransfer(remoteIsWindows: boolean) {
    await this.trzszTransfer.sendAction(false, remoteIsWindows)
  }

  // 接受文件
  public async acceptTransfer(remoteIsWindows: boolean) {
    await this.trzszTransfer.sendAction(true, remoteIsWindows)
    return this.trzszTransfer
  }

  // 抛出错误来实现中断
  // message 自定义中断消息
  // type 不能是 fail/FAIL/EXIT
  public throwError(message: string, type?: string) {
    throw new TrzszError(message, type)
  }

  // 初始化进度条
  public initProgressBar(tmux_pane_width?: number) {
    this.textProgressBar = new TextProgressBar(this.writeToTerminal, this.terminalColumns, tmux_pane_width)
  }

  public updateProgressBar(method: 'onNum' | 'onName' | 'onSize' | 'onStep' | 'onDone', ...args: any[]) {
    this.textProgressBar?.[method]?.(...args)
  }
}
