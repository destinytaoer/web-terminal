import * as React from 'react'
import { Typography, Space, Card } from 'antd'
import { Link } from 'react-router-dom'

const { Title } = Typography

export function Home() {
  return (
    <div className={'p-10'}>
      <Title>Web Terminal 演示</Title>
      <Space direction='horizontal' align='start' size={16}>
        <Link to='/basic'>
          <Card title='TerminalCore 功能调试' style={{ width: 300 }}>
            <p>调试 TerminalCore 和 xterm 的功能</p>
          </Card>
        </Link>
        <Link to='/node-pty'>
          <Card title='node pty 连接调试' style={{ width: 300 }}>
            <p>调试 web terminal 与 node pty 建立连接的过程和消息传输过程, 可以从 server 中简单理解后端如何与 pty 交互</p>
          </Card>
        </Link>
        <Link to='/exec'>
          <Card title='k8s exec api 连接调试' style={{ width: 300 }}>
            <p>调试 web terminal 与 k8s exec api 建立连接和消息传输</p>
          </Card>
        </Link>
      </Space>
    </div>
  )
}
