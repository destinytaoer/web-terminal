/**
 * 终端控制符参考:
 * - https://zyxin.xyz/blog/2020-05/terminal-control-characters/
 * - https://www2.ccs.neu.edu/research/gpc/VonaUtils/vona/terminal/vtansi.htm
 * - https://en.wikipedia.org/wiki/ANSI_escape_code
 */
export const TerminalController = {
  // 回车 CARRIAGE_RETURN
  CR: '\x0d', // \r
  // 换行 LINE_FEED
  LF: '\x0a', // \n
  // Form Feed 换页
  FF: '\x0c',
  // 回车换行
  CRLF: '\x0d\x0a', // \r\n
  // 铃声
  BEL: '\x07',
  // Backspace 退格键, 光标前移
  BS: '\x08',
  // Tab
  HT: '\x09',
  // 转义序列
  ESC: '\x1b',

  // Control Sequence Introducer  控制序列引入器
  CSI: '\x1b\x9b', // ESC [: \x1b[
  // Operating System Command  操作系统命令
  OSC: '\x1b\x9d', // ESC ]: \x1b]

  // 修改标题
  changeTitle: (title: string) => {
    return `${TerminalController.OSC}0;${title}${TerminalController.BEL}`
  },
  // 清除行
  eraseInLine(type: 'END_OF_LINE' | 'START_OF_LINE' | 'LINE' = 'END_OF_LINE') {
    // EL Erase in Line
    // CSI n K: 如果 n 为 0 （或缺失），则清除从光标到行尾的内容。如果 n 为 1 ，则清除从光标到行首的内容。如果 n 为 2 ，则清除整行。光标位置不变。
    let n = 0
    switch (type) {
      case 'END_OF_LINE':
        n = 0
        break
      case 'START_OF_LINE':
        n = 1
        break
      case 'LINE':
        n = 2
        break
    }
    return `${TerminalController.CSI}${n}K`
  },
  // 清屏
  eraseInDisplay(type: 'DOWN_OF_SCREEN' | 'UP_OF_SCREEN' | 'SCREEN') {
    // ED Erase in Display
    // CSI n J: 如果 n 为 0 （或缺失），则清除从光标到屏幕末尾的内容。如果 n 为 1 ，则清除从光标到屏幕开头的内容。如果 n 为 2 ，则清除整个屏幕（并将光标移动到 DOS ANSI.SYS 的左上角）。如果 n 为 3 ，则清除整个屏幕并删除回滚缓冲区中保存的所有行
    let n = 0
    switch (type) {
      case 'DOWN_OF_SCREEN':
        n = 0
        break
      case 'UP_OF_SCREEN':
        n = 1
        break
      case 'SCREEN':
        n = 2
        break
    }
    return `${TerminalController.CSI}${n}J`
  },
}