const { WebSocketServer, OPEN } = require('ws')
const qs = require('querystring')
const Terminal = require('../utils/pty')

class PtyWs {
  online
  ws

  terminals = {}

  constructor(server) {
    this.init(server)
  }

  init(server) {
    // 创建实例
    this.ws = new WebSocketServer({ server, path: '/node-pty' })

    this.ws.on('connection', (socket, request) => {
      if (!request.url.includes('/node-pty')) {
        return socket.close()
      }
      this.online = this.ws._server._connections
      console.log(`socket当前在线${this.online}个连接`)

      const query = qs.parse(request.url.split('?')[1] ?? '')
      if (!query?.id) {
        return socket.close()
      }
      // 记录 id
      socket.id = query.id

      const terminal = this.createTerminal(query)

      // socket.on 表示服务器接收一个客户端message 事件
      socket.on('message', (data) => {
        this.processMessageFromClient(query.id, data)
      })

      // 客户端断开，自带事件
      socket.on('disconnect', function () {
        console.log('disconnect')
        terminal.kill()
      })
    })
  }

  createTerminal({ cols, rows, id }) {
    console.log(cols, rows)

    const terminal = new Terminal([], {
      cols: Number(cols),
      rows: Number(rows),
    })

    terminal.onData((data) => {
      // send data
      this.sendMessageToClient(id, 'input', data)
    })

    terminal.onExit((exitCode, signal) => {
      // close socket
      this.closeClient(id, exitCode)
    })

    this.terminals[id] = terminal

    return terminal
  }

  processMessageFromClient(id, message) {
    const terminal = this.terminals[id]
    try {
      if (terminal) {
        const data = JSON.parse(message.toString())
        console.log('receive message from client', data)
        switch (data?.type) {
          case 'input':
            console.log('write to terminal', data?.content)
            terminal.write(data?.content ?? '')
            break
          case 'heartbeat':
            this.sendMessageToClient(id, 'heartbeat')
            break
          case 'resize':
            const { cols, rows } = data?.content ?? {}
            terminal.resize(cols, rows)
            break
        }
      }
    } catch (e) {
      console.log(`process message from ${id} error`, e)
    }
  }

  // 发送客户端数据
  sendMessageToClient(id, type, data) {
    const socket = this.getSocketById(id)
    if (this.isSocketReady(socket)) {
      switch (type) {
        case 'input':
          socket.send(JSON.stringify({ type: 'input', content: data }))
          break
        case 'heartbeat':
          socket.send(JSON.stringify({ type: 'heartbeat' }))
          break
      }
    }
  }

  closeClient(id, exitCode) {
    const socket = this.getSocketById(id)
    socket?.close(1006, `exit code ${exitCode}`)
  }

  getSocketById(id) {
    return [...this.ws.clients].find((client) => client.id === id)
  }

  isSocketReady(socket) {
    return socket?.readyState === OPEN
  }
}

module.exports = PtyWs
