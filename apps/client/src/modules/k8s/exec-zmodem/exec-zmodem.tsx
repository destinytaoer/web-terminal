import { useTerminal } from './service/useTerminal'
import 'xterm/css/xterm.css'

export function ExecZmodem() {
  const { terminalEl } = useTerminal()
  return <div ref={terminalEl} className='w-screen h-screen bg-black'></div>
}
