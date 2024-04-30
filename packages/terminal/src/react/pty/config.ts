import { Terminal } from '@xterm/xterm'
import qs from 'qs'

export const HeartbeatTime = 15 * 1000

export function spliceUrl(url: string, xterm: Terminal) {
  const [path, search] = url.split('?')
  const query = qs.parse(search)
  const rows = xterm.rows
  const cols = xterm.cols
  const newQuery = qs.stringify({
    ...query,
    rows: rows,
    cols: cols,
  })
  return `${path}?${newQuery}`
}
