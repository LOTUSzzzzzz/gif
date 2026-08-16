export function repairTransparentGif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 13 || bytes[0] !== 0x47) return bytes;

  const packed = bytes[10];
  const globalColorTableSize = 1 << ((packed & 0x07) + 1);
  let pos = 13 + globalColorTableSize * 3;

  let transparentIndex: number | null = null;
  while (pos + 2 <= bytes.length) {
    const marker = bytes[pos];
    if (marker === 0x21) {
      const label = bytes[pos + 1];
      if (label === 0xf9) {
        if (pos + 8 > bytes.length) return bytes;
        const blockSize = bytes[pos + 2];
        const flags = bytes[pos + 3];
        if (blockSize === 4 && (flags & 1) === 1) {
          transparentIndex = bytes[pos + 6];
          break;
        }
        pos += 2 + 1 + blockSize + 1;
      } else {
        pos += 2;
        while (pos < bytes.length) {
          const size = bytes[pos];
          pos += 1 + size;
          if (size === 0) break;
        }
      }
    } else if (marker === 0x2c || marker === 0x3b) {
      break;
    } else {
      pos += 1;
    }
  }

  if (transparentIndex === null || bytes[11] === transparentIndex) {
    return bytes;
  }
  const repaired = bytes.slice();
  repaired[11] = transparentIndex;
  return repaired;
}
