const pty = require('node-pty');
const os = require('os');

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// 参考 node-pty 文档:
// https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts
module.exports = class Terminal {
  _terminal;

  constructor(args = [], options) {
    this._terminal = pty.spawn(shell, args, {
      name: 'xterm-color',
      // cols: 80,
      // rows: 30,
      cwd: process.env.HOME,
      env: process.env,
      ...options,
    });
  }

  write(data) {
    this._terminal.write(data);
  }

  resize(columns, rows) {
    this._terminal.resize(columns, rows);
  }

  onData(fn) {
    this._terminal.on('data', (data) => {
      fn(data);
    });
  }

  onExit(fn) {
    this._terminal.on('exit', (exitCode, signal) => {
      fn(exitCode, signal);
    });
  }

  kill(signal) {
    this._terminal.kill(signal);
  }
};
