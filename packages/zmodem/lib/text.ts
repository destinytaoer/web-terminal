class _my_TextEncoder {
  encode(text: string) {
    text = unescape(encodeURIComponent(text))

    const bytes = new Array(text.length)

    for (let b = 0; b < text.length; b++) {
      bytes[b] = text.charCodeAt(b)
    }

    return new Uint8Array(bytes)
  }
}

class _my_TextDecoder {
  decode(bytes: Uint8Array) {
    return decodeURIComponent(escape(String.fromCharCode(...bytes)))
  }
}

/**
 * A limited-use compatibility shim for TextEncoder and TextDecoder.
 * Useful because both Edge and node.js still lack support for these
 * as of October 2017.
 *
 * @exports Text
 */
export const Text = {
  Encoder: typeof TextEncoder !== 'undefined' ? TextEncoder : _my_TextEncoder,
  Decoder: typeof TextDecoder !== 'undefined' ? TextDecoder : _my_TextDecoder,
}
