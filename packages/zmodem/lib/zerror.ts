function _pass(val) {
  return val
}

export class ZmodemError extends Error {
  type?: string

  got?: any

  expected?: any

  message: string

  _crc_message = (got: any, expected: any) => {
    this.got = got.slice(0)
    this.expected = expected.slice(0)
    return 'CRC check failed! (got: ' + got.join() + '; expected: ' + expected.join() + ')'
  }

  TYPE_MESSAGE: Record<string, string | ((...arg: any[]) => any)> = {
    aborted: 'Session aborted',
    peer_aborted: 'Peer aborted session',
    already_aborted: 'Session already aborted',
    crc: this._crc_message,
    validation: _pass,
  }

  constructor(msg_or_type: string, got?: any, expected?: any) {
    super()

    const generated = this._generate_message(msg_or_type, got, expected)
    if (generated) {
      this.type = msg_or_type
      this.message = generated
    } else {
      this.message = msg_or_type
    }
  }

  _generate_message(type: string, ...args: any[]) {
    const msg = this.TYPE_MESSAGE[type]
    switch (typeof msg) {
      case 'string':
        return msg
      case 'function':
        return msg(...args)
    }

    return null
  }
}
