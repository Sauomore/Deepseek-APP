/** Small id helper — collision-safe enough for local device storage. */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function uid(size = 12): string {
  let out = ''
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(size)
    cryptoObj.getRandomValues(bytes)
    for (let i = 0; i < size; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length]
    return out
  }
  for (let i = 0; i < size; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

export function prefixedId(prefix: string, size = 12): string {
  return `${prefix}_${uid(size)}`
}
