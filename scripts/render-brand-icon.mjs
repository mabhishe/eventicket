/**
 * Rasterize the EventPass ticket mark into the favicon files Next serves.
 * The header uses the same ticket path as a stroke; these files are a filled
 * version so the mark stays readable at 16px in a browser tab or chat app.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1a120c"/>
  <g transform="translate(6 8) scale(2.15)">
    <path fill="#FA6C00" d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5Z"/>
    <path d="M13 5.2v13.6" stroke="#1a120c" stroke-width="1.7" stroke-dasharray="2.1 1.55" stroke-linecap="butt" fill="none"/>
  </g>
</svg>`;

function icoFromPngs(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + 16 * count;
  const entries = pngs.map((png) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(png.size >= 256 ? 0 : png.size, 0);
    entry.writeUInt8(png.size >= 256 ? 0 : png.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.buf.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((png) => png.buf)]);
}

const master = sharp(Buffer.from(svg));
const sizes = [16, 32, 48, 256];
const pngs = [];
for (const size of sizes) {
  const buf = await master
    .clone()
    .resize(size, size)
    .png()
    .toBuffer();
  pngs.push({ size, buf });
}

writeFileSync("app/favicon.ico", icoFromPngs(pngs));
writeFileSync("app/icon.png", pngs.find((png) => png.size === 32).buf);
writeFileSync(
  "app/apple-icon.png",
  await master.clone().resize(180, 180).png().toBuffer(),
);
console.log("wrote app/favicon.ico, app/icon.png, app/apple-icon.png");
