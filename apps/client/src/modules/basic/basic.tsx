import { useTerminal } from './service/useTerminal'

interface IBasicProps {}

export function Basic(props: IBasicProps) {
  const {} = props
  const { terminalEl } = useTerminal()
  return <div ref={terminalEl} className='w-screen h-screen bg-black'></div>
}
