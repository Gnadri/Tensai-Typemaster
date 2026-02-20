const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceManifest = path.join(rootDir, 'extension', 'manifest.json');
const distDir = path.join(rootDir, 'dist');
const distManifest = path.join(distDir, 'manifest.json');
const sourceLogo = path.join(rootDir, 'assets', 'logo.png');
const distLogo = path.join(distDir, 'logo.png');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.copyFileSync(sourceManifest, distManifest);
fs.copyFileSync(sourceLogo, distLogo);
console.log('Copied extension manifest and logo to dist/');
