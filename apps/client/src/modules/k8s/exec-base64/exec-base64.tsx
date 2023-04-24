import { useTerminal } from './service/useTerminal.ts'
import 'xterm/css/xterm.css'

export function ExecBase64() {
  const { terminalEl } = useTerminal()
  return <div ref={terminalEl} className='w-screen h-screen bg-black'></div>
}
