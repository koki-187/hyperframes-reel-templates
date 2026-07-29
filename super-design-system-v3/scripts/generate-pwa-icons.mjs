import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('../apps/mobile-pwa/icons');await fs.mkdir(out,{recursive:true});
const svg=size=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#07090d"/><circle cx="256" cy="256" r="148" fill="none" stroke="#b8ff2c" stroke-width="24"/><path d="M126 302C202 202 282 172 390 126" fill="none" stroke="#f2f4f6" stroke-width="28" stroke-linecap="round"/><circle cx="256" cy="256" r="34" fill="#b8ff2c"/><text x="256" y="438" text-anchor="middle" font-family="Arial,sans-serif" font-size="58" font-weight="900" fill="#f2f4f6">14DNA</text></svg>`;
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512]])await sharp(Buffer.from(svg(size))).resize(size,size).png().toFile(path.join(out,name));
console.log('PWA icons generated');
