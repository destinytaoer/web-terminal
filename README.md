# Web Terminal

web terminal demo, 使用 turborepo & pnpm workspace 创建的 monorepo 项目

实现 demo:

- [x] node-pty
- [ ] node-pty in binary
- [ ] k8s exec in base64 channel
- [ ] k8s exec in binary channel
- [ ] k8s exec with zmodem

## Start

### Dev

```bash
pnpm i
pnpm dev
```

### Apps

- client: web 界面
- server: node 服务

### Packages

- tsconfig: ts 配置
- core: web terminal 核心代码

## Information

### core process

web terminal 的核心流程:

- init terminal
    - new Terminal
    - terminal.open(element)
    - load renderer -> webgl/canvas
    - load fitAddon -> fit window resize listener
    - load weblinkAddon
    - ...other
- connect websocket
    - new Websocket -> with auth info & terminal size info
    - socket onopen -> terminal.focus / send auth message & terminal size message
    - socket onerror -> terminal.write('connect error') / error handler
    - socket onclose -> terminal.write('disconnect')/ dispose / show close code and reason
    - socket onmessage -> terminal.write -> 返回消息处理
    - terminal onData -> socket send input message -> 输入消息处理
    - terminal onResize -> socket send resize message
    - deal time -> socket send heartbeat message
- dispose terminal
    - socket.close
    - terminal.dispose
    - window remove resize listener
