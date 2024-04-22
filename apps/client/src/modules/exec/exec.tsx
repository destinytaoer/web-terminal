import * as React from 'react'
import { Button, Form, Input } from 'antd'
import { useExecTerminal } from 'terminal'

export function Exec() {
  const { terminalEl, connect } = useExecTerminal()

  const onConnect = (values: { url: string; token: string }) => {
    const { url, token } = values
    const connect_url = `${url}?token=${token}`
    console.log('connect_url', connect_url)
    connect(connect_url)
  }

  return (
    <div>
      <div className={'h-10'}>
        <Form
          className={'flex items-center'}
          onFinish={onConnect}
          initialValues={{
            url: '',
            token: '',
          }}
        >
          <Form.Item name={'url'}>
            <Input placeholder={'请输入 url'} />
          </Form.Item>
          <Form.Item name={'token'}>
            <Input placeholder={'请输入 token'} />
          </Form.Item>
          <Form.Item className={'ml-auto'}>
            <Button htmlType={'submit'}>连接</Button>
          </Form.Item>
        </Form>
      </div>
      <div ref={terminalEl}></div>
    </div>
  )
}
