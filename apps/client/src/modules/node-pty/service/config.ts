import { log, MessageData } from 'core'
import { WorkerTimer } from 'worker-timer'
import { ReceiveMessageData } from 'terminal/src/core/AttachAddon'
import { Buffer } from 'buffer'

// 生成发送给服务端的消息
export function processMessageToServer(data: MessageData) {
  // log.warn('to server', data)
  const { type, content } = data
  switch (type) {
    case 'resize':
      return JSON.stringify({ type: 'resize', content })
    case 'data':
    case 'binary':
      return content
    case 'heartbeat':
      return JSON.stringify({ type: 'heartbeat' })
  }
  return ''
}

// 处理服务端消息
export function processMessageFromServer(message: string | ArrayBuffer): ReceiveMessageData {
  if (typeof message === 'string') {
    try {
      const data = JSON.parse(message)
      if (data.type === 'input') {
        return { type: 'stdout', message: data.content ?? '' }
      }
      return { type: 'stdout', message: data.content ?? '' }
    } catch (e) {
      return { type: 'error', error: e }
    }
  } else {
    const buffer = Buffer.from(message)
    const content = buffer.toString()
    // log.info('receive message from server', content)
    return { type: 'stdout', message: buffer }
  }
}

export function uploadFile(): Promise<FileList> {
  return new Promise((resolve, reject) => {
    const inputDom = document.createElement('input')
    inputDom.type = 'file'
    inputDom.multiple = true
    inputDom.addEventListener('change', (e) => {
      const files = e.target?.files as FileList
      console.log('files', files)
      resolve(files)
    })

    inputDom.addEventListener('cancel', () => {
      reject()
    })

    inputDom.click()
    // inputDom.close()
  })
}

// 创建心跳
export function createHeartbeat(heartbeat: () => void) {
  // 添加心跳
  const workerTimer = new WorkerTimer()
  let timer: number | undefined

  const start = () => {
    timer = workerTimer.setWorkerTimer('interval', heartbeat, 30 * 1000)
  }

  const stop = () => {
    if (timer) workerTimer.clearWorkerTimer(timer)
  }

  return {
    start,
    stop,
  }
}
