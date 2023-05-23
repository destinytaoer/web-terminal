import { Octets } from './encode'
import { CRC, CRCFunction } from './zcrc'
import { ZmodemZDLE } from './zdle'
import { ZMLIB } from './zmlib'

const ZCRCE = 0x68, // 'h', 104, frame ends, header packet follows
  ZCRCG = 0x69, // 'i', 105, frame continues nonstop
  ZCRCQ = 0x6a, // 'j', 106, frame continues, ZACK expected
  ZCRCW = 0x6b // 'k', 107, frame ends, ZACK expected

/** Class that represents a ZMODEM data subpacket. */
export class ZmodemSubpacket {
  /**
   * Build a Subpacket subclass given a payload and frame end string.
   *
   * @param {Array} octets - The octet values to parse.
   *      Each array member should be an 8-bit unsigned integer (0-255).
   *
   * @param {string} frameend - One of:
   * - `no_end_no_ack`
   * - `end_no_ack`
   * - `no_end_ack` (unused currently)
   * - `end_ack`
   *
   * @returns {Subpacket} An instance of the appropriate Subpacket subclass.
   */
  static build(octets: Octets, frameend: keyof typeof SUBPACKET_BUILDER) {
    //TODO: make this better
    const Ctr = SUBPACKET_BUILDER[frameend]
    if (!Ctr) {
      throw new Error('No subpacket type “' + frameend + '” is defined! Try one of: ' + Object.keys(SUBPACKET_BUILDER).join(', '))
    }

    return new Ctr(octets)
  }

  /**
   * Return the octet values array that represents the object
   * encoded with a 16-bit CRC.
   *
   * @param {ZDLE} zencoder - A ZDLE instance to use for ZDLE encoding.
   *
   * @returns {number[]} An array of octet values suitable for sending
   *      as binary data.
   */
  encode16(zencoder: ZmodemZDLE) {
    return this._encode(zencoder, CRC.crc16)
  }

  /**
   * Return the octet values array that represents the object
   * encoded with a 32-bit CRC.
   *
   * @param {ZDLE} zencoder - A ZDLE instance to use for ZDLE encoding.
   *
   * @returns {number[]} An array of octet values suitable for sending
   *      as binary data.
   */
  encode32(zencoder: ZmodemZDLE) {
    return this._encode(zencoder, CRC.crc32)
  }

  /**
   * Return the subpacket payload’s octet values.
   *
   * NOTE: For speed, this returns the actual data in the subpacket;
   * if you mutate this return value, you alter the Subpacket object
   * internals. This is OK if you won’t need the Subpacket anymore, but
   * just be careful.
   *
   * @returns {number[]} The subpacket’s payload, represented as an
   * array of octet values. **DO NOT ALTER THIS ARRAY** unless you
   * no longer need the Subpacket.
   */
  get_payload() {
    return this._payload
  }

  /**
   * Parse out a Subpacket object from a given array of octet values,
   * assuming a 16-bit CRC.
   *
   * An exception is thrown if the given bytes are definitively invalid
   * as subpacket values with 16-bit CRC.
   *
   * @param {number[]} octets - The octet values to parse.
   *      Each array member should be an 8-bit unsigned integer (0-255).
   *      This object is mutated in the function.
   *
   * @returns {Subpacket|undefined} An instance of the appropriate Subpacket
   *      subclass, or undefined if not enough octet values are given
   *      to determine whether there is a valid subpacket here or not.
   */
  static parse16(octets: Octets) {
    return ZmodemSubpacket._parse(octets, 2)
  }

  //parse32 test:
  //[102, 105, 108, 101, 110, 97, 109, 101, 119, 105, 116, 104, 115, 112, 97, 99, 101, 115, 0, 49, 55, 49, 51, 49, 52, 50, 52, 51, 50, 49, 55, 50, 49, 48, 48, 54, 52, 52, 48, 49, 49, 55, 0, 43, 8, 63, 115, 23, 17]

  /**
   * Same as parse16(), but assuming a 32-bit CRC.
   *
   * @param {number[]} octets - The octet values to parse.
   *      Each array member should be an 8-bit unsigned integer (0-255).
   *      This object is mutated in the function.
   *
   * @returns {Subpacket|undefined} An instance of the appropriate Subpacket
   *      subclass, or undefined if not enough octet values are given
   *      to determine whether there is a valid subpacket here or not.
   */
  static parse32(octets: Octets) {
    return ZmodemSubpacket._parse(octets, 4)
  }

  /**
   * Not used directly.
   */
  constructor(payload: Octets) {
    this._payload = payload
  }

  _encode(zencoder: ZmodemZDLE, crc_func: CRCFunction) {
    return zencoder
      .encode(this._payload.slice(0))
      .concat([ZMLIB.ZDLE, this._frameend_num], zencoder.encode(crc_func(this._payload.concat(this._frameend_num))))
  }

  //Because of ZDLE encoding, we’ll never see any of the frame-end octets
  //in a stream except as the ends of data payloads.
  static _parse(bytes_arr: Octets, crc_len: number) {
    let end_at
    let creator: typeof ZmodemSubpacket | undefined

    //These have to be written in decimal since they’re lookup keys.
    const _frame_ends_lookup: Record<number, typeof ZmodemSubpacket> = {
      104: ZEndNoAckSubpacket,
      105: ZNoEndNoAckSubpacket,
      106: ZNoEndAckSubpacket,
      107: ZEndAckSubpacket,
    }

    let zdle_at = 0
    while (zdle_at < bytes_arr.length) {
      zdle_at = bytes_arr.indexOf(ZMLIB.ZDLE, zdle_at)
      if (zdle_at === -1) return

      const after_zdle = bytes_arr[zdle_at + 1]
      creator = _frame_ends_lookup[after_zdle]
      if (creator) {
        end_at = zdle_at + 1
        break
      }

      zdle_at++
    }

    if (!creator) return

    const frameend_num = bytes_arr[end_at]

    //sanity check
    if (bytes_arr[end_at - 1] !== ZMLIB.ZDLE) {
      throw new Error('Byte before frame end should be ZDLE, not ' + bytes_arr[end_at - 1])
    }

    const zdle_encoded_payload = bytes_arr.splice(0, end_at - 1)

    const got_crc = ZmodemZDLE.splice(bytes_arr, 2, crc_len)
    if (!got_crc) {
      //got payload but no CRC yet .. should be rare!

      //We have to put the ZDLE-encoded payload back before returning.
      bytes_arr.unshift(...zdle_encoded_payload)

      return
    }

    const payload = ZmodemZDLE.decode(zdle_encoded_payload)

    //We really shouldn’t need to do this, but just for good measure.
    //I suppose it’s conceivable this may run over UDP or something?
    CRC[crc_len === 2 ? 'verify16' : 'verify32'](payload.concat([frameend_num]), got_crc)

    return new creator(payload, got_crc)
  }
}

class ZEndSubpacketBase extends ZmodemSubpacket {
  frame_end() {
    return true
  }
}

class ZNoEndSubpacketBase extends ZmodemSubpacket {
  frame_end() {
    return false
  }
}

//Used for end-of-file.
class ZEndNoAckSubpacket extends ZEndSubpacketBase {
  _frameend_num = ZCRCE

  ack_expected() {
    return false
  }
}

//Used for ZFILE and ZSINIT payloads.
class ZEndAckSubpacket extends ZEndSubpacketBase {
  _frameend_num = ZCRCW

  ack_expected() {
    return true
  }
}

//Used for ZDATA, prior to end-of-file.
class ZNoEndNoAckSubpacket extends ZNoEndSubpacketBase {
  _frameend_num = ZCRCG

  ack_expected() {
    return false
  }
}

//only used if receiver can full-duplex
class ZNoEndAckSubpacket extends ZNoEndSubpacketBase {
  _frameend_num = ZCRCQ

  ack_expected() {
    return true
  }
}

const SUBPACKET_BUILDER = {
  end_no_ack: ZEndNoAckSubpacket,
  end_ack: ZEndAckSubpacket,
  no_end_no_ack: ZNoEndNoAckSubpacket,
  no_end_ack: ZNoEndAckSubpacket,
} as const
