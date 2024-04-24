import { AttachAddon, ReceiveMessageData, SendMessageData } from '../../core'
import { concatUint8Array, log, stringToUint8Array, uint8ArrayToString } from '../../utils'
import { HeartbeatTime, MessageChannel } from './config'

export class ExecAttachAddon extends AttachAddon {
  heartbeatTime = HeartbeatTime

  // 处理服务端消息回显
  processMessageFromServer = (data: string | ArrayBuffer): ReceiveMessageData => {
    if (typeof data === 'string') {
      log.warn('something error')
      return {
        type: 'error',
        error: { message: 'Type of receive data from server is string, please make it binary' },
      }
    }

    const buffer = new Uint8Array(data)
    const type = buffer[0]
    const content = buffer.slice(1)
    switch (type) {
      case MessageChannel.StdIn:
        log.info('receive heartbeat from server')
        // 后端使用 stdin 来返回响应 heartbeat
        return { type: 'heartbeat' }
      case MessageChannel.StdOut:
      case MessageChannel.StdError:
        return { type: 'stdout', content }
      case MessageChannel.ServiceError:
        const msg = uint8ArrayToString(content)
        const error = this.handleServerError(msg)
        return { type: 'error', error }
    }

    log.error('Unhandled message channel')
    return { type: 'error', error: { message: 'Unhandled message channel' } }
  }

  // 生成发送给服务端的消息
  processMessageToServer = (data: SendMessageData) => {
    const { type, content } = data
    switch (type) {
      case 'resize': {
        const { cols, rows } = content
        const msg = JSON.stringify({
          Width: cols,
          Height: rows,
        })

        const type = Uint8Array.of(MessageChannel.Resize)
        const msgBuffer = stringToUint8Array(msg)
        return concatUint8Array(type, msgBuffer)
      }
      case 'data':
      case 'binary': {
        const type = Uint8Array.of(MessageChannel.StdIn)
        const msgBuffer = stringToUint8Array(content)
        return concatUint8Array(type, msgBuffer)
      }
      case 'heartbeat': {
        return Uint8Array.of(MessageChannel.StdIn)
      }
    }
    return ''
  }

  // https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/kubelet/pkg/cri/streaming/remotecommand/exec.go#L59
  // 1. InternalError : Internal error occurred: error executing command in container: failed to exec in container: failed to create exec "76b05d56cdb8b43330c42eab8fd0f56a7fe377238e1679d5f80a7e2e325176e3": cannot exec in a paused state: unknown
  // Internal error occurred: error executing command in container: failed to exec in container: failed to start exec "cdf7c53189ee86aa8974a4690614ec700d9cdeb11f5382e1fb44d266bdffb898": OCI runtime exec failed: exec failed: unable to start container process: open /dev/ptmx: no space left on device: unknown
  // 2.NonZeroExitCode : command terminated with non-zero exit code: error executing command [/bin/sh -c TERM=xterm-256color; export TERM; [ -x /bin/bash ] && ([ -x /usr/bin/script ] && /usr/bin/script -q -c "/bin/bash" /dev/null || exec /bin/bash) || exec /bin/sh], exit code 137
  // command terminated with non-zero exit code: error executing command [/bin/sh -c TERM=xterm-256color; export TERM; export LINES=42; export COLUMNS=168; [ -x /bin/bash ] && ([ -x /usr/bin/script ] && /usr/bin/script -q -c "/bin/bash" /dev/null || exec /bin/bash) || exec /bin/sh], exit code 143
  handleServerError = (msg: string) => {
    const reg = /exit code ([0-9]+)/
    const [, exitCode] = msg.match(reg) ?? []
    switch (exitCode) {
      case '137':
        const message = 'exit code 137: pod terminated'
        log.error(message)
        return { message, exitCode: 137 }
      case undefined:
        log.error(msg)
        return { message: msg }
      default:
        log.error(`exit code ${exitCode}: ${msg}`)
        return { message: msg, exitCode }
    }
  }
}
