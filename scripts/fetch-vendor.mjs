// =============================================================================
// VIS · fetch-vendor (Node version, for machines without curl e.g. Windows)
// Downloads the browser libraries into assets/vendor/ so VIS runs fully offline.
// Run ONCE on a machine with internet, then commit assets/vendor/ and deploy.
//
//   node scripts/fetch-vendor.mjs
//
// Requires Node 18+ (uses the built-in fetch).
// =============================================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'vendor');

const files = [
  ['https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js', 'echarts.min.js'],
  ['https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', 'html-to-image.js'],
  ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'pptxgen.bundle.js']
];

await mkdir(dir, { recursive: true });
console.log('Downloading VIS libraries into public/assets/vendor/ ...');
for (const [url, name] of files) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(dir, name), buf);
  console.log('  -> public/assets/vendor/' + name + '  (' + Math.round(buf.length / 1024) + ' KB)');
}
console.log('\nDone. VIS now loads these locally (no external CDN needed).');
console.log('Commit the public/assets/vendor/ folder to ship an offline / internal build.');
