import { ISearchOptions } from '@xterm/addon-search'
import { ITerminalOptions, ITheme } from '@xterm/xterm'
// 默认主题配置
// https://github.com/xtermjs/xterm.js/blob/5.3.0/typings/xterm.d.ts#L323
export const DEFAULT_THEME: ITheme = {
  selectionBackground: '#2e5b8c',
}

// xterm 默认配置
// https://github.com/xtermjs/xterm.js/blob/5.3.0/typings/xterm.d.ts#L26
export const DEFAULT_XTERM_OPTIONS: ITerminalOptions = {
  cursorBlink: true,
  allowProposedApi: true,
  theme: DEFAULT_THEME,
}

// 搜索默认配置
// https://github.com/xtermjs/xterm.js/blob/5.3.0/addons/xterm-addon-search/src/SearchAddon.ts#L10
export const DEFAULT_SEARCH_OPTIONS: ISearchOptions = {
  incremental: true,
}
