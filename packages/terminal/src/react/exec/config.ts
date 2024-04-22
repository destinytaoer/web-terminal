import { Terminal } from '@xterm/xterm'
import qs from 'qs'

export const Protocol = 'channel.k8s.io'

export const MessageChannel = {
  StdIn: 0,
  StdOut: 1,
  StdError: 2,
  ServiceError: 3,
  Resize: 4,
}

export const HeartbeatTime = 15 * 1000

export function spliceUrl(url: string, xterm: Terminal) {
  const [path, search] = url.split('?')
  const query = qs.parse(search)
  const rows = xterm.rows
  const cols = xterm.cols
  const newQuery = qs.stringify({
    ...query,
    lines: rows,
    columns: cols,
  })
  return `${path}?${newQuery}`
}
