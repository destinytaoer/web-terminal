import { ENCODELIB } from './encode'
import { Text } from './text'
import { CRC } from './zcrc'
import { ZmodemZDLE } from './zdle'
import { ZmodemError } from './zerror'
import { ZmodemHeader } from './zheader'
import { ZMLIB } from './zmlib'
import { Browser } from './zmodem_browser'
import { Detection, ZmodemSentry } from './zsentry'
import { DEBUG, Offer, setDebug, Transfer, ZmodemReceiveSession, ZmodemSendSession, ZmodemSession } from './zsession'
import { ZmodemSubpacket } from './zsubpacket'
import { Validation } from './zvalidation'

const Zmodem = {
  ENCODELIB,
  Text,
  Error: ZmodemError,
  CRC,
  ZMLIB,
  ZDLE: ZmodemZDLE,
  Header: ZmodemHeader,
  Browser,
  Subpacket: ZmodemSubpacket,
  Validation,
  Session: ZmodemSession,
  SendSession: ZmodemSendSession,
  ReceiveSession: ZmodemReceiveSession,
  Offer,
  Transfer,
  DEBUG,
  setDebug,
  Sentry: ZmodemSentry,
  Detection,
}

export type { Octets } from './encode'
export type { CRCFunction } from './zcrc'
export type { Detection, ZmodemSentry } from './zsentry'
export type { Offer, Transfer, ZmodemReceiveSession, ZmodemSendSession, ZmodemSession } from './zsession'

export default Zmodem
