/**
 * Syncs required pdfjs-dist runtime assets (worker & CMap/font/ICC/WASM fallbacks)
 * from node_modules into public/pdfjs/ so PDF parsing runs 100% same-origin
 * without external CDN dependencies (unpkg/cdnjs) that get blocked by CSP or firewalls.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
let pdfjsRoot = path.join(projectRoot, 'node_modules', 'pdfjs-dist');
if (!fs.existsSync(pdfjsRoot)) {
  const pkgPath = require.resolve('pdfjs-dist/package.json', { paths: [projectRoot] });
  pdfjsRoot = path.dirname(pkgPath);
}
const targetRoot = path.join(projectRoot, 'public', 'pdfjs');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.endsWith('.map')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

// Serve minified ES-module worker with .js extension so reverse proxies (e.g. Nginx)
// always return application/javascript under X-Content-Type-Options: nosniff.
const workerSrc = path.join(pdfjsRoot, 'build', 'pdf.worker.min.mjs');
const workerDest = path.join(targetRoot, 'pdf.worker.min.js');
if (!fs.existsSync(workerSrc)) {
  throw new Error(`Missing pdfjs worker at ${workerSrc}`);
}
fs.copyFileSync(workerSrc, workerDest);

for (const subdir of ['cmaps', 'standard_fonts', 'iccs', 'wasm']) {
  copyDirRecursive(path.join(pdfjsRoot, subdir), path.join(targetRoot, subdir));
}

console.log(`[sync-pdfjs-assets] Synced pdfjs-dist assets to ${path.relative(projectRoot, targetRoot)}`);
