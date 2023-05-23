import { ZmodemError } from './zerror'

const LOOKS_LIKE_ZMODEM_HEADER = /\*\x18[AC]|\*\*\x18B/

function _validate_number(key: string, value: number) {
  if (value < 0) {
    throw new ZmodemError('validation', '“' + key + '” (' + value + ') must be nonnegative.')
  }

  if (value !== Math.floor(value)) {
    throw new ZmodemError('validation', '“' + key + '” (' + value + ') must be an integer.')
  }
}

interface FileDetails {}

/** Validation logic for zmodem.js
 *
 * @exports Validation
 */
export const Validation = {
  /**
   * Validates and normalizes a set of parameters for an offer to send.
   * NOTE: This returns “mtime” as epoch seconds, not a Date. This is
   * inconsistent with the get_details() method in Session, but it’s
   * more useful for sending over the wire.
   *
   * @param {FileDetails} params - The file details. Some fairly trivial
   * variances from the specification are allowed.
   *
   * @return {FileDetails} The parameters that should be sent. `mtime`
   * will be a Date rather than a number.
   */
  offer_parameters: function offer_parameters(params: FileDetails) {
    if (!params.name) {
      throw new ZmodemError('validation', 'Need “name”!')
    }

    if (typeof params.name !== 'string') {
      throw new ZmodemError('validation', '“name” (' + params.name + ') must be a string!')
    }

    //So that we can override values as is useful
    //without affecting the passed-in object.
    params = Object.assign({}, params)

    if (LOOKS_LIKE_ZMODEM_HEADER.test(params.name)) {
      console.warn(
        'The filename ' +
          JSON.stringify(name) +
          ' contains characters that look like a ZMODEM header. This could corrupt the ZMODEM session; consider renaming it so that the filename doesn’t contain control characters.',
      )
    }

    if (params.serial !== null && params.serial !== undefined) {
      throw new ZmodemError('validation', '“serial” is meaningless.')
    }

    params.serial = null
    ;['size', 'mode', 'files_remaining', 'bytes_remaining'].forEach(function (k) {
      let ok
      switch (typeof params[k]) {
        case 'object':
          ok = params[k] === null
          break
        case 'undefined':
          params[k] = null
          ok = true
          break
        case 'number':
          _validate_number(k, params[k] as number)

          ok = true
          break
      }

      if (!ok) {
        throw new ZmodemError('validation', '“' + k + '” (' + params[k] + ') must be null, undefined, or a number.')
      }
    })

    if (typeof params.mode === 'number') {
      params.mode |= 0x8000
    }

    if (params.files_remaining === 0) {
      throw new ZmodemError('validation', '“files_remaining”, if given, must be positive.')
    }

    let mtime_ok
    switch (typeof params.mtime) {
      case 'object':
        mtime_ok = true

        if (params.mtime instanceof Date) {
          const date_obj = params.mtime
          params.mtime = Math.floor(date_obj.getTime() / 1000)
          if (params.mtime < 0) {
            throw new ZmodemError('validation', '“mtime” (' + date_obj + ') must not be earlier than 1970.')
          }
        } else if (params.mtime !== null) {
          mtime_ok = false
        }

        break

      case 'undefined':
        params.mtime = null
        mtime_ok = true
        break
      case 'number':
        _validate_number('mtime', params.mtime)
        mtime_ok = true
        break
    }

    if (!mtime_ok) {
      throw new ZmodemError(
        'validation',
        '“mtime” (' + params.mtime + ') must be null, undefined, a Date, or a number.',
      )
    }

    return params
  },
}
