// Generates the PWA icons as real PNG files with no image library.
// Draws a dumbbell glyph on a dark background. Run: npm run gen-icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const BG = [0x0b, 0x0d, 0x10, 0xff]; // app background
const BAR = [0x4c, 0x8d, 0xff, 0xff]; // accent blue
const PLATE = [0xe8, 0xec, 0xf1, 0xff]; // near-white

// --- tiny PNG encoder (8-bit RGBA, no filtering) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// --- draw the icon ---
function drawIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = c[3];
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };

  // background
  rect(0, 0, size, size, BG);

  // For "any" icons draw the glyph large; for maskable keep it inside the
  // 80% safe zone so launcher masks don't clip it.
  const s = maskable ? 0.62 : 0.78;
  const g = Math.round(size * s); // glyph box size
  const ox = Math.round((size - g) / 2);
  const oy = Math.round((size - g) / 2);

  const barY = oy + Math.round(g * 0.44);
  const barH = Math.round(g * 0.12);
  // handle bar
  rect(ox + Math.round(g * 0.18), barY, Math.round(g * 0.64), barH, BAR);
  // inner plates
  rect(ox + Math.round(g * 0.12), barY - Math.round(g * 0.12), Math.round(g * 0.09), barH + Math.round(g * 0.24), PLATE);
  rect(ox + Math.round(g * 0.79), barY - Math.round(g * 0.12), Math.round(g * 0.09), barH + Math.round(g * 0.24), PLATE);
  // outer plates
  rect(ox + Math.round(g * 0.02), barY - Math.round(g * 0.2), Math.round(g * 0.09), barH + Math.round(g * 0.4), PLATE);
  rect(ox + Math.round(g * 0.89), barY - Math.round(g * 0.2), Math.round(g * 0.09), barH + Math.round(g * 0.4), PLATE);

  return encodePng(size, size, buf);
}

for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), drawIcon(size, false));
  writeFileSync(join(OUT, `icon-${size}-maskable.png`), drawIcon(size, true));
  console.log(`wrote icon-${size}.png and icon-${size}-maskable.png`);
}
