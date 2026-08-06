import zlib from "node:zlib";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA8888 row-major */
  rgba: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function applyFilter(
  filter: number,
  row: Uint8Array,
  prev: Uint8Array | null,
  bpp: number,
): void {
  if (filter === 0) return;
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp]! : 0;
    const up = prev ? prev[i]! : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp]! : 0;
    switch (filter) {
      case 1:
        row[i] = (row[i]! + left) & 0xff;
        break;
      case 2:
        row[i] = (row[i]! + up) & 0xff;
        break;
      case 3:
        row[i] = (row[i]! + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        row[i] = (row[i]! + paeth(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`UNSUPPORTED_PNG_FILTER_${filter}`);
    }
  }
}

/** Decode PNG (color types 0/2/6, 8-bit) to RGBA8888. */
export function decodePngRgba(buf: Buffer): DecodedPng {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("NOT_PNG");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Buffer[] = [];

  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("ascii");
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      if (bitDepth !== 8) throw new Error("UNSUPPORTED_PNG_BIT_DEPTH");
      if (![0, 2, 6].includes(colorType)) throw new Error("UNSUPPORTED_PNG_COLOR_TYPE");
    } else if (type === "IDAT") {
      idatParts.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height) throw new Error("NOT_PNG");

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const bpp = channels;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rgba = new Uint8Array(width * height * 4);
  let inOff = 0;
  let prevRow: Uint8Array | null = null;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOff]!;
    inOff += 1;
    const row = inflated.subarray(inOff, inOff + stride);
    inOff += stride;
    const decoded = new Uint8Array(row);
    applyFilter(filter, decoded, prevRow, bpp);
    prevRow = decoded;

    for (let x = 0; x < width; x += 1) {
      const di = (y * width + x) * 4;
      if (colorType === 6) {
        rgba[di] = decoded[x * 4]!;
        rgba[di + 1] = decoded[x * 4 + 1]!;
        rgba[di + 2] = decoded[x * 4 + 2]!;
        rgba[di + 3] = decoded[x * 4 + 3]!;
      } else if (colorType === 2) {
        rgba[di] = decoded[x * 3]!;
        rgba[di + 1] = decoded[x * 3 + 1]!;
        rgba[di + 2] = decoded[x * 3 + 2]!;
        rgba[di + 3] = 255;
      } else {
        const g = decoded[x]!;
        rgba[di] = g;
        rgba[di + 1] = g;
        rgba[di + 2] = g;
        rgba[di + 3] = 255;
      }
    }
  }

  return { width, height, rgba };
}

/** LVGL LV_COLOR_FORMAT_ARGB8888 little-endian byte order (B,G,R,A). */
export function rgbaToLvglArgb8888(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const a = rgba[i + 3]!;
    out[i] = b;
    out[i + 1] = g;
    out[i + 2] = r;
    out[i + 3] = a;
  }
  return out;
}
