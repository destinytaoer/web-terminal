export function concatUint8Array(buffer1: Uint8Array, buffer2: Uint8Array) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(buffer1, 0)
  tmp.set(buffer2, buffer1.byteLength)
  return tmp
}

export function uint8ArrayToString(buffer: Uint8Array) {
  const textDecoder = new TextDecoder()
  return textDecoder.decode(buffer)
}

export function stringToUint8Array(str: string) {
  const textEncoder = new TextEncoder()
  return textEncoder.encode(str)
}
