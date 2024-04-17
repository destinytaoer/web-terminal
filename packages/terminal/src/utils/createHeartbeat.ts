import { WorkerTimer } from './worker-timer'

// 创建心跳
export function createHeartbeat(heartbeat: () => void, heartbeatTime = 30 * 1000) {
  // 添加心跳
  const workerTimer = new WorkerTimer()
  let timer: number | undefined

  const start = () => {
    timer = workerTimer.setWorkerTimer('interval', heartbeat, heartbeatTime)
  }

  const stop = () => {
    if (timer) workerTimer.clearWorkerTimer(timer)
  }

  return {
    start,
    stop,
  }
}
