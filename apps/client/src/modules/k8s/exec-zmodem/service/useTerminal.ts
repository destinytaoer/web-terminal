import { useEffect, useRef } from 'react'
import { useCreation } from 'ahooks'
import { log, WebTerminal } from 'core'
import { WorkerTimer } from 'worker-timer'
import { processMessageToServer, k8s, processMessageFromServer, selectFile } from './config'

const url = 'wss://exec'
const token = 'YVK5BTRG4KSodSt7HMgvVnGpSe3bH0GSdeqaKUUqmL0.kYuoG9v5psIyTaSs5KBLM34tr1H5dAscoNhMaN3T0UE'
export const useTerminal = () => {
  const terminalEl = useRef<HTMLDivElement>(null)
  const terminal = useCreation(() => {
    return new WebTerminal({})
  }, [])

  useEffect(() => {
    if (url && terminalEl.current) {
      const xterm = terminal.init(terminalEl.current)
      terminal.fitWindowResize()

      const cols = xterm.cols
      const rows = xterm.rows
      const urlWithQuery = `${url}?token=${token}&columns=${cols}&lines=${rows}`

      const socket = terminal.connectSocket(urlWithQuery, [k8s.protocol.binary], {
        processMessageToServer,
        processMessageFromServer,
        enableZmodem: true,
        enableTrzsz: true,
        onSend: () => {
          selectFile()
            .then((files) => {
              const file = files.item(0)
              if (!file) {
                throw new Error("doesn't select any file")
              }
              const fileSize = file?.size
              if (fileSize > 200 * 1024 * 1024) {
                // TODO: 弹窗提示用户超过预定文件大小了
                // message.warn('限制上传 200MB 以内的文件')
                throw new Error('over limit')
              }
              log.success('prepare to upload files', files, fileSize)
              terminal.sendFiles(files)
            })
            .catch((e: any) => {
              log.warn('cancel upload files', e)
              terminal.cancelUploadFile()
            })
        },
      })

      // 添加心跳
      const workerTimer = new WorkerTimer()
      let timer: number | undefined

      function startHeartbeat() {
        timer = workerTimer.setWorkerTimer(
          'interval',
          function () {
            log.info('send heartbeat', new Date().toLocaleString())
            socket?.sendMessage('heartbeat')
          },
          30 * 1000,
        )
      }

      function stopHeartbeat() {
        if (timer) workerTimer.clearWorkerTimer(timer)
      }

      const onopen = () => {
        terminal.focus()
        startHeartbeat()
      }
      const onerror = () => {
        terminal.write('Connect Error.')
      }
      const onclose = (e) => {
        const { code, reason } = e
        console.error('close', code, reason)
        terminal.write('disconnect.')
        stopHeartbeat()
      }

      socket.addEventListener('open', onopen)
      socket.addEventListener('error', onerror)
      socket.addEventListener('close', onclose)

      return () => {
        stopHeartbeat()
        socket.removeEventListener('open', onopen)
        socket.removeEventListener('error', onerror)
        socket.removeEventListener('close', onclose)
        terminal.destroy()
      }
    }
  }, [url])

  return {
    terminalEl,
  }
}
